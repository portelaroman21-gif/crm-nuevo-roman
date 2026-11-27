"use strict";
const { db } = require("../db.js");
const F = require("./fechas.js");
const P = require("./personas.js");

const TIPOS = ["seguimientos", "prospeccion", "captacion", "visitas", "contenido", "suelto"];

// Cuánto tarda un item, para saber cuántos entran en el bloque.
const MINUTOS_POR_ITEM = { seguimientos: 3, captacion: 4, contenido: 20, prospeccion: 2 };

const FIN_DEL_DIA = 21 * 60; // 21:00

function cupo(bloque) {
  if (bloque.objetivo != null) return bloque.objetivo;
  const porItem = MINUTOS_POR_ITEM[bloque.tipo];
  if (!porItem) return null;
  return Math.max(1, Math.floor(bloque.minutos / porItem));
}

function plantillaDe(ambito, dia) {
  return db.prepare("SELECT * FROM plantilla WHERE ambito = ? AND dia = ? ORDER BY hora").all(ambito, dia);
}

function bloquesDe(fecha) {
  return db.prepare("SELECT * FROM bloques WHERE fecha = ? ORDER BY hora, id").all(fecha);
}

// Arma el día desde la plantilla de la semana. Idempotente: si ya se armó, no toca nada.
async function armar(fecha) {
  const estado = await db.prepare("SELECT * FROM dias WHERE fecha = ?").get(fecha);
  if (estado && estado.armado) return bloquesDe(fecha);

  const filas = await plantillaDe("semana", F.diaSemana(fecha));
  await db.transaccion(async (tx) => {
    const poner = tx.prepare(
      "INSERT INTO bloques (fecha, nombre, tipo, hora, minutos, objetivo, fijo) VALUES (?, ?, ?, ?, ?, ?, 0)"
    );
    for (const p of filas) await poner.run(fecha, p.nombre, p.tipo, p.hora, p.minutos, p.objetivo);
    await tx
      .prepare("INSERT INTO dias (fecha, armado) VALUES (?, 1) ON CONFLICT (fecha) DO UPDATE SET armado = 1")
      .run(fecha);
  });
  await sincronizarAgenda(fecha);
  return bloquesDe(fecha);
}

// Cada visita o reunión de la agenda es un bloque fijo del día.
async function sincronizarAgenda(fecha) {
  const citas = await db.prepare("SELECT * FROM agenda WHERE fecha = ? ORDER BY hora").all(fecha);
  const existentes = await db.prepare("SELECT * FROM bloques WHERE fecha = ? AND agendaId IS NOT NULL").all(fecha);
  const porCita = new Map(existentes.map((b) => [b.agendaId, b]));

  for (const cita of citas) {
    const ya = porCita.get(cita.id);
    const nombre = cita.titulo;
    if (ya) {
      if (ya.hora !== cita.hora || ya.minutos !== cita.minutos || ya.nombre !== nombre) {
        await db
          .prepare("UPDATE bloques SET hora = ?, minutos = ?, nombre = ? WHERE id = ?")
          .run(cita.hora, cita.minutos, nombre, ya.id);
      }
      porCita.delete(cita.id);
    } else {
      await db
        .prepare(
          "INSERT INTO bloques (fecha, nombre, tipo, hora, minutos, fijo, agendaId) VALUES (?, ?, 'visitas', ?, ?, 1, ?)"
        )
        .run(fecha, nombre, cita.hora, cita.minutos, cita.id);
    }
  }
  for (const sobrante of porCita.values()) {
    await db.prepare("DELETE FROM bloques WHERE id = ?").run(sobrante.id);
  }
  return reacomodar(fecha);
}

// La agenda manda: los bloques fijos se quedan donde están y los demás se corren.
// Devuelve los que no entraron antes del fin del día.
async function reacomodar(fecha) {
  const todos = await bloquesDe(fecha);
  const fijos = todos
    .filter((b) => b.fijo)
    .map((b) => ({ desde: F.minutosDe(b.hora), hasta: F.minutosDe(b.hora) + b.minutos }))
    .sort((a, b) => a.desde - b.desde);

  const sueltos = todos.filter((b) => !b.fijo).sort((a, b) => F.minutosDe(a.hora) - F.minutosDe(b.hora));
  const afuera = [];
  const ocupado = [...fijos];

  for (const bloque of sueltos) {
    let inicio = F.minutosDe(bloque.hora);
    let movido = true;
    let vueltas = 0;
    while (movido && vueltas < 50) {
      movido = false;
      vueltas += 1;
      for (const tramo of ocupado) {
        if (inicio < tramo.hasta && inicio + bloque.minutos > tramo.desde) {
          inicio = tramo.hasta;
          movido = true;
        }
      }
    }
    if (inicio + bloque.minutos > FIN_DEL_DIA) {
      afuera.push({ id: bloque.id, nombre: bloque.nombre });
      continue;
    }
    const hora = F.horaDesdeMinutos(inicio);
    if (hora !== bloque.hora) await db.prepare("UPDATE bloques SET hora = ? WHERE id = ?").run(hora, bloque.id);
    ocupado.push({ desde: inicio, hasta: inicio + bloque.minutos });
    ocupado.sort((a, b) => a.desde - b.desde);
  }
  return afuera;
}

function tildadosDe(bloqueId) {
  return db.prepare("SELECT * FROM tildes WHERE bloqueId = ?").all(bloqueId);
}

// Los items que van adentro de un bloque, según su tipo.
async function itemsDe(bloque, fecha) {
  const tildes = await tildadosDe(bloque.id);
  const hechos = new Set(tildes.filter((t) => t.personaId).map((t) => t.personaId));
  const cupoBloque = cupo(bloque);

  if (bloque.tipo === "seguimientos" || bloque.tipo === "captacion") {
    const lista = bloque.tipo === "captacion" ? "captacion" : null;
    let candidatos = await P.cola(fecha, lista);
    if (bloque.tipo === "seguimientos") candidatos = candidatos.filter((p) => p.lista !== "captacion");
    const pendientes = candidatos.filter((p) => !hechos.has(p.id));
    const visibles = cupoBloque ? pendientes.slice(0, cupoBloque) : pendientes;
    // Los tildados salen de la cola (se les movió la fecha), así que se leen
    // de los propios tildes: el bloque tiene que seguir mostrando lo que hiciste.
    const yaHechos = [];
    for (const id of hechos) {
      const p = await P.porId(id);
      if (p) yaHechos.push({ ...p, atraso: 0, hecho: true });
    }
    return {
      items: [...yaHechos, ...visibles.map((p) => ({ ...p, hecho: false }))],
      cupo: cupoBloque,
      pendientesTotales: pendientes.length,
      fueraDelBloque: Math.max(0, pendientes.length - (cupoBloque || pendientes.length)),
    };
  }

  if (bloque.tipo === "visitas") {
    const campos = `SELECT a.*, p.nombre personaNombre, p.telefono personaTelefono, p.lista personaLista
                      FROM agenda a LEFT JOIN personas p ON p.id = a.personaId`;
    const citas = bloque.agendaId
      ? await db.prepare(`${campos} WHERE a.id = ?`).all(bloque.agendaId)
      : await db.prepare(`${campos} WHERE a.fecha = ? ORDER BY a.hora`).all(fecha);
    return { items: citas.map((c) => ({ ...c, hecho: !!c.hecho })), cupo: null, pendientesTotales: citas.length, fueraDelBloque: 0 };
  }

  if (bloque.tipo === "contenido") {
    const hechosContenido = new Set(tildes.filter((t) => t.contenidoId).map((t) => t.contenidoId));
    const piezas = await db
      .prepare("SELECT * FROM contenido WHERE etapa <> 'publicado' ORDER BY COALESCE(fechaObjetivo, '9999'), id")
      .all();
    const visibles = cupoBloque ? piezas.slice(0, cupoBloque) : piezas;
    return {
      items: visibles.map((c) => ({ ...c, hecho: hechosContenido.has(c.id) })),
      cupo: cupoBloque,
      pendientesTotales: piezas.length,
      fueraDelBloque: Math.max(0, piezas.length - visibles.length),
    };
  }

  if (bloque.tipo === "prospeccion") {
    const hechosHoy = (
      await db
        .prepare(
          "SELECT COUNT(*) n FROM contactos WHERE fecha = ? AND tipo = 'frio' AND canal IN ('whatsapp','copia')"
        )
        .get(fecha)
    ).n;
    return { items: [], cupo: cupoBloque, pendientesTotales: 0, fueraDelBloque: 0, hechosHoy };
  }

  const tareas = await db
    .prepare("SELECT * FROM sueltos WHERE fecha = ? AND (bloqueId IS NULL OR bloqueId = ?) ORDER BY id")
    .all(fecha, bloque.id);
  return { items: tareas.map((t) => ({ ...t, hecho: !!t.hecho })), cupo: null, pendientesTotales: tareas.length, fueraDelBloque: 0 };
}

async function delDia(fecha) {
  await armar(fecha);
  const afuera = await reacomodar(fecha);
  const crudos = await bloquesDe(fecha);
  const bloques = [];
  for (const b of crudos) bloques.push({ ...b, ...(await itemsDe(b, fecha)) });
  const estado = (await db.prepare("SELECT * FROM dias WHERE fecha = ?").get(fecha)) || { fecha, armado: 1, cerrado: 0 };
  return { fecha, diaSemana: F.diaSemana(fecha), bloques, afuera, cerrado: !!estado.cerrado };
}

// Un tilde: queda registrado el contacto y se mueve la próxima fecha.
async function tildar(bloqueId, { personaId = null, contenidoId = null, texto = null, canal = "whatsapp", nota = null }) {
  const bloque = await db.prepare("SELECT * FROM bloques WHERE id = ?").get(Number(bloqueId));
  if (!bloque) return null;
  const fecha = bloque.fecha;

  if (personaId) {
    const ya = await db.prepare("SELECT id FROM tildes WHERE bloqueId = ? AND personaId = ?").get(bloque.id, Number(personaId));
    if (ya) return { repetido: true };
    await db
      .prepare("INSERT INTO tildes (bloqueId, personaId, texto, fecha, ts) VALUES (?, ?, ?, ?, ?)")
      .run(bloque.id, Number(personaId), nota, fecha, F.ahora());
    const r = await P.registrarContacto(personaId, { canal, nota, fecha });
    return { persona: r && r.persona, tipo: r && r.tipo };
  }

  if (contenidoId) {
    await db
      .prepare("INSERT INTO tildes (bloqueId, contenidoId, texto, fecha, ts) VALUES (?, ?, ?, ?, ?)")
      .run(bloque.id, Number(contenidoId), texto, fecha, F.ahora());
    return { contenidoId: Number(contenidoId) };
  }

  await db.prepare("INSERT INTO tildes (bloqueId, texto, fecha, ts) VALUES (?, ?, ?, ?)").run(bloque.id, texto, fecha, F.ahora());
  return { texto };
}

async function destildar(bloqueId, personaId) {
  const tilde = await db
    .prepare("SELECT * FROM tildes WHERE bloqueId = ? AND personaId = ?")
    .get(Number(bloqueId), Number(personaId));
  if (!tilde) return false;
  await db.prepare("DELETE FROM tildes WHERE id = ?").run(tilde.id);
  const ultimo = await db.prepare("SELECT * FROM contactos WHERE personaId = ? ORDER BY ts DESC LIMIT 1").get(Number(personaId));
  if (ultimo && Math.abs(ultimo.ts - tilde.ts) < 5 * 60000) {
    await db.prepare("DELETE FROM contactos WHERE id = ?").run(ultimo.id);
    await db
      .prepare("UPDATE personas SET sinRespuesta = GREATEST(0, sinRespuesta - 1), proximoContacto = ? WHERE id = ?")
      .run(tilde.fecha, Number(personaId));
  }
  return true;
}

module.exports = {
  TIPOS, MINUTOS_POR_ITEM, FIN_DEL_DIA,
  cupo, plantillaDe, bloquesDe, armar, sincronizarAgenda, reacomodar,
  itemsDe, delDia, tildar, destildar,
};
