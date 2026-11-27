"use strict";
const { db } = require("../db.js");
const F = require("./fechas.js");
const O = require("./origenes.js");

const LISTAS = ["lead", "calificado", "captacion", "desarrollador"];

const NOMBRE_LISTA = {
  lead: "Leads",
  calificado: "Calificados",
  captacion: "Captación",
  desarrollador: "Desarrolladores",
};

// Cada cuántos días vuelve alguien a la cola, por lista.
const RITMO = { lead: 2, calificado: 7, captacion: 10, desarrollador: 30 };

// Cuánto pesa cada lista cuando hay que ordenar la cola.
const PESO = { calificado: 40, captacion: 25, desarrollador: 25, lead: 10 };

const INTENTOS_PARA_FRIO = 6;
const DIAS_DE_FRIO = 90;

const CAMPOS_COMUNES = ["nombre", "telefono", "origen", "origenNota", "queQuiere", "proximoPaso"];
const CAMPOS_POR_LISTA = {
  lead: [],
  calificado: ["operacion", "zona", "rango", "plazo", "mostrado"],
  captacion: ["direccion", "tipoPropiedad", "precioPretendido", "conOtra", "exclusivoHasta", "zona"],
  desarrollador: ["empresa", "rol", "tipoLote", "zona", "superficie", "obraEnMarcha"],
};
const BOOLEANOS = new Set(["conOtra", "obraEnMarcha", "importante", "frio", "cerrado"]);

// El teléfono es la llave. Guardamos los últimos 8 dígitos porque en Argentina
// el mismo número aparece como 1173931186, +5491173931186 o 11 7393-1186.
function clavePorTelefono(telefono) {
  const digitos = String(telefono || "").replace(/\D/g, "");
  if (digitos.length < 6) return "";
  return digitos.slice(-8);
}

async function porTelefono(telefono) {
  const clave = clavePorTelefono(telefono);
  if (!clave) return null;
  return (await db.prepare("SELECT * FROM personas WHERE clave = ?").get(clave)) || null;
}

async function porId(id) {
  return (await db.prepare("SELECT * FROM personas WHERE id = ?").get(Number(id))) || null;
}

function campoPermitido(lista, campo) {
  if (CAMPOS_COMUNES.includes(campo)) return true;
  if (["importante", "frio", "frioHasta", "cerrado", "cerradoFecha", "cerradoMonto", "proximoContacto"].includes(campo))
    return true;
  return (CAMPOS_POR_LISTA[lista] || []).includes(campo);
}

function limpiar(valor, campo) {
  if (BOOLEANOS.has(campo)) return valor ? 1 : 0;
  if (valor == null) return null;
  const t = String(valor).trim();
  return t === "" ? null : t;
}

async function crear(datos) {
  const lista = LISTAS.includes(datos.lista) ? datos.lista : "lead";
  const nombre = String(datos.nombre || "").trim();
  if (!nombre) throw new Error("Falta el nombre");
  const clave = clavePorTelefono(datos.telefono);
  if (clave) {
    const ya = await db.prepare("SELECT * FROM personas WHERE clave = ?").get(clave);
    if (ya) {
      const e = new Error("Ese número ya está cargado");
      e.duplicado = ya;
      throw e;
    }
  }
  const ahora = F.hoy();
  const origen = O.existe(datos.origen) ? datos.origen : O.adivinar(datos.origen);
  const columnas = {
    lista, nombre, clave: clave || null, creado: ahora, actualizado: ahora,
    origen,
    // Lo guardamos resuelto para que contar en frío sea una consulta y no
    // dependa de recorrer el catálogo en memoria.
    esFrio: O.esFrio(origen) ? 1 : 0,
  };
  columnas.proximoContacto = F.esFecha(datos.proximoContacto) ? datos.proximoContacto : ahora;
  columnas.origenMapa = datos.origenMapa ? 1 : 0;
  for (const campo of [...CAMPOS_COMUNES, ...CAMPOS_POR_LISTA[lista], "importante"]) {
    if (campo === "nombre" || campo === "origen") continue;
    if (campo in datos) columnas[campo] = limpiar(datos[campo], campo);
  }
  const claves = Object.keys(columnas);
  const info = await db
    .prepare(
      `INSERT INTO personas (${claves.join(", ")}) VALUES (${claves.map((c) => "@" + c).join(", ")})`
    )
    .run(columnas);
  return porId(info.lastInsertRowid);
}

async function actualizar(id, datos) {
  const persona = await porId(id);
  if (!persona) return null;
  const lista = LISTAS.includes(datos.lista) ? datos.lista : persona.lista;
  const cambios = {};

  if (lista !== persona.lista) cambios.lista = lista;

  if ("telefono" in datos) {
    const clave = clavePorTelefono(datos.telefono);
    if (clave && clave !== persona.clave) {
      const ya = await db.prepare("SELECT * FROM personas WHERE clave = ? AND id <> ?").get(clave, persona.id);
      if (ya) {
        const e = new Error("Ese número ya está cargado en otra ficha");
        e.duplicado = ya;
        throw e;
      }
    }
    cambios.telefono = limpiar(datos.telefono, "telefono");
    cambios.clave = clave || null;
  }

  for (const campo of Object.keys(datos)) {
    if (["id", "lista", "telefono", "clave", "creado", "actualizado", "esFrio"].includes(campo)) continue;
    if (!campoPermitido(lista, campo)) continue;
    cambios[campo] = limpiar(datos[campo], campo);
  }

  if ("origen" in datos) {
    const origen = O.existe(datos.origen) ? datos.origen : O.adivinar(datos.origen);
    cambios.origen = origen;
    cambios.esFrio = O.esFrio(origen) ? 1 : 0;
  }

  if (Object.keys(cambios).length === 0) return persona;
  cambios.actualizado = F.hoy();
  const sets = Object.keys(cambios).map((c) => `${c} = @${c}`).join(", ");
  await db.prepare(`UPDATE personas SET ${sets} WHERE id = @id`).run({ ...cambios, id: persona.id });
  return porId(persona.id);
}

// Deja a alguien en frío: sale de la cola diaria y vuelve solo el día de revisión.
async function enfriar(id, dias = DIAS_DE_FRIO) {
  const hasta = F.sumarDias(F.hoy(), dias);
  await db
    .prepare("UPDATE personas SET frio = 1, frioHasta = ?, proximoContacto = ?, actualizado = ? WHERE id = ?")
    .run(hasta, hasta, F.hoy(), Number(id));
  return porId(id);
}

async function descongelar(id) {
  await db
    .prepare(
      "UPDATE personas SET frio = 0, frioHasta = NULL, sinRespuesta = 0, proximoContacto = ?, actualizado = ? WHERE id = ?"
    )
    .run(F.hoy(), F.hoy(), Number(id));
  return porId(id);
}

// Un contacto hecho: mueve la próxima fecha y, si ya van muchos sin respuesta, enfría.
async function registrarContacto(id, { canal = "whatsapp", nota = null, fecha = null } = {}) {
  const persona = await porId(id);
  if (!persona) return null;
  const dia = fecha && F.esFecha(fecha) ? fecha : F.hoy();

  const previos = (await db.prepare("SELECT COUNT(*) n FROM contactos WHERE personaId = ? AND tipo <> 'entrante'").get(persona.id)).n;
  const hablo = (await db.prepare("SELECT COUNT(*) n FROM contactos WHERE personaId = ? AND tipo = 'entrante'").get(persona.id)).n;
  // Prospección en frío es sólo el primer contacto a alguien que buscaste vos.
  // Si te llegó por publicidad o por un referido, es un primer contacto tibio:
  // cuenta como contacto, pero no ensucia el embudo de prospección.
  const esPrimero = previos === 0 && hablo === 0;
  const tipo = esPrimero ? (persona.esFrio ? "frio" : "primero") : "seguimiento";

  await db
    .prepare("INSERT INTO contactos (personaId, tipo, canal, lista, nota, fecha, ts) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(persona.id, tipo, canal, persona.lista, nota, dia, F.ahora());

  const sinRespuesta = persona.sinRespuesta + 1;
  const ritmo = RITMO[persona.lista] || 7;
  const proximo = F.sumarDias(dia, ritmo);
  await db
    .prepare(
      "UPDATE personas SET sinRespuesta = ?, proximoContacto = ?, proximoPaso = COALESCE(?, proximoPaso), actualizado = ? WHERE id = ?"
    )
    .run(sinRespuesta, proximo, nota, F.hoy(), persona.id);

  if (sinRespuesta >= INTENTOS_PARA_FRIO && !persona.frio) await enfriar(persona.id);
  return { persona: await porId(persona.id), tipo };
}

// Me escribió: resetea los intentos y lo vuelve a poner adelante.
async function registrarEntrante(id, nota = null) {
  const persona = await porId(id);
  if (!persona) return null;
  await db
    .prepare(
      "INSERT INTO contactos (personaId, tipo, canal, lista, nota, fecha, ts) VALUES (?, 'entrante', 'whatsapp', ?, ?, ?, ?)"
    )
    .run(persona.id, persona.lista, nota, F.hoy(), F.ahora());
  await db
    .prepare(
      "UPDATE personas SET sinRespuesta = 0, frio = 0, frioHasta = NULL, proximoContacto = ?, actualizado = ? WHERE id = ?"
    )
    .run(F.hoy(), F.hoy(), persona.id);
  return porId(persona.id);
}

// La cola: todos los que tienen fecha vencida o de hoy, en orden.
async function cola(fecha = F.hoy(), lista = null) {
  // Lo que cargaste hoy y todavía no contactaste vive en el bloque de
  // prospección, no acá: si no, la misma persona aparece en dos bloques el
  // mismo día. Desde mañana entra a la cola como cualquier otro.
  const filas = await db
    .prepare(
      `SELECT * FROM personas
        WHERE cerrado = 0
          AND proximoContacto IS NOT NULL
          AND proximoContacto <= ?
          AND NOT (
            creado = ?
            AND NOT EXISTS (
              SELECT 1 FROM contactos c WHERE c.personaId = personas.id AND c.tipo <> 'entrante'
            )
          )
          ${lista ? "AND lista = ?" : ""}`
    )
    .all(...(lista ? [fecha, fecha, lista] : [fecha, fecha]));

  return filas
    .map((p) => {
      const atraso = Math.max(0, F.diferenciaDias(p.proximoContacto, fecha));
      const peso = (p.importante ? 1000 : 0) + atraso * 12 + (PESO[p.lista] || 10) + (p.origenMapa ? 5 : 0);
      return { ...p, atraso, peso };
    })
    .sort((a, b) => b.peso - a.peso || a.nombre.localeCompare(b.nombre, "es"));
}

function historial(id, limite = 50) {
  return db.prepare("SELECT * FROM contactos WHERE personaId = ? ORDER BY ts DESC LIMIT ?").all(Number(id), limite);
}

module.exports = {
  LISTAS, NOMBRE_LISTA, RITMO, PESO, INTENTOS_PARA_FRIO, DIAS_DE_FRIO,
  CAMPOS_COMUNES, CAMPOS_POR_LISTA,
  clavePorTelefono, porTelefono, porId, crear, actualizar, enfriar, descongelar,
  registrarContacto, registrarEntrante, cola, historial,
};
