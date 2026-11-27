"use strict";
const { db } = require("../db.js");
const F = require("./fechas.js");
const O = require("./origenes.js");

// Lo que el sistema no puede ver solo lleva botón.
const MANUALES = [
  { clave: "llamada_captacion", nombre: "Llamadas en frío · captación", grupo: "Llamadas" },
  { clave: "llamada_venta", nombre: "Llamadas en frío · venta", grupo: "Llamadas" },
  { clave: "localizado_prospecto", nombre: "Prospectos localizados", grupo: "Localizados" },
  { clave: "localizado_propiedad", nombre: "Propiedades localizadas", grupo: "Localizados" },
];

async function manual(fecha, clave) {
  const f = await db.prepare("SELECT valor FROM contadores WHERE fecha = ? AND clave = ?").get(fecha, clave);
  return f ? f.valor : 0;
}

async function sumar(fecha, clave, paso = 1) {
  const permitido = MANUALES.some((m) => m.clave === clave);
  if (!permitido) throw new Error("Contador desconocido");
  await db
    .prepare(
      `INSERT INTO contadores (fecha, clave, valor) VALUES (?, ?, GREATEST(0, ?))
       ON CONFLICT (fecha, clave) DO UPDATE SET valor = GREATEST(0, contadores.valor + ?)`
    )
    .run(fecha, clave, paso, paso);
  return manual(fecha, clave);
}

async function automaticos(fecha) {
  const uno = async (sql, ...args) => (await db.prepare(sql).get(fecha, ...args)).n;

  const contactos = await uno(
    "SELECT COUNT(*) n FROM contactos WHERE fecha = ? AND tipo <> 'entrante' AND canal IN ('whatsapp','copia')"
  );
  const porWhatsapp = await uno(
    "SELECT COUNT(*) n FROM contactos WHERE fecha = ? AND tipo <> 'entrante' AND canal = 'whatsapp'"
  );
  const porCopia = await uno(
    "SELECT COUNT(*) n FROM contactos WHERE fecha = ? AND tipo <> 'entrante' AND canal = 'copia'"
  );

  const seguimientos = (
    await db
      .prepare(
        `SELECT COUNT(*) n FROM tildes t
           JOIN bloques b ON b.id = t.bloqueId
          WHERE t.fecha = ? AND t.personaId IS NOT NULL
            AND b.tipo IN ('seguimientos','captacion')`
      )
      .get(fecha)
  ).n;

  const frioCaptacion = await uno(
    "SELECT COUNT(*) n FROM contactos WHERE fecha = ? AND tipo = 'frio' AND canal IN ('whatsapp','copia') AND lista = 'captacion'"
  );
  const frioVenta = await uno(
    "SELECT COUNT(*) n FROM contactos WHERE fecha = ? AND tipo = 'frio' AND canal IN ('whatsapp','copia') AND lista <> 'captacion'"
  );

  // Primer contacto a alguien que NO buscaste vos: te llegó por publicidad
  // o por un referido. Cuenta como contacto, pero no es prospección.
  const primeros = await uno(
    "SELECT COUNT(*) n FROM contactos WHERE fecha = ? AND tipo = 'primero' AND canal IN ('whatsapp','copia')"
  );

  const meHablaron = (
    await db.prepare("SELECT COUNT(DISTINCT personaId) n FROM contactos WHERE fecha = ? AND tipo = 'entrante'").get(fecha)
  ).n;

  const visitasAgendadas = await uno("SELECT COUNT(*) n FROM agenda WHERE fecha = ?");
  const visitasHechas = await uno("SELECT COUNT(*) n FROM agenda WHERE fecha = ? AND hecho = 1");

  const leadsNuevos = await uno("SELECT COUNT(*) n FROM personas WHERE creado = ?");
  const calificadosNuevos = (
    await db.prepare("SELECT COUNT(*) n FROM personas WHERE lista = 'calificado' AND actualizado = ?").get(fecha)
  ).n;

  return {
    contactos, porWhatsapp, porCopia, seguimientos, primeros,
    frioCaptacion, frioVenta, frio: frioCaptacion + frioVenta,
    meHablaron, visitasAgendadas, visitasHechas, leadsNuevos, calificadosNuevos,
  };
}

// Los siete números del End of Day, en el orden en que se leen.
async function delDia(fecha = F.hoy()) {
  const a = await automaticos(fecha);
  const m = {};
  for (const x of MANUALES) m[x.clave] = await manual(fecha, x.clave);

  const numeros = [
    { clave: "contactos", nombre: "Contactos hechos", valor: a.contactos, auto: true,
      detalle: `${a.porWhatsapp} abriendo WhatsApp · ${a.porCopia} copiando el número` },
    { clave: "seguimientos", nombre: "Seguimientos hechos", valor: a.seguimientos, auto: true,
      detalle: "cada tilde de un bloque" },
    { clave: "frio", nombre: "Prospección en frío", valor: a.frio, auto: true,
      detalle: a.primeros
        ? `${a.frioCaptacion} captación · ${a.frioVenta} venta · ${a.primeros} primer contacto tibio aparte`
        : `${a.frioCaptacion} captación · ${a.frioVenta} venta` },
    { clave: "me_hablaron", nombre: "Me hablaron", valor: a.meHablaron, auto: true,
      detalle: "personas distintas que escribieron primero" },
    { clave: "llamadas", nombre: "Llamadas en frío", valor: m.llamada_captacion + m.llamada_venta, auto: false,
      partes: [
        { clave: "llamada_captacion", nombre: "captación", valor: m.llamada_captacion },
        { clave: "llamada_venta", nombre: "venta", valor: m.llamada_venta },
      ] },
    { clave: "localizados", nombre: "Localizados", valor: m.localizado_prospecto + m.localizado_propiedad, auto: false,
      partes: [
        { clave: "localizado_prospecto", nombre: "prospectos", valor: m.localizado_prospecto },
        { clave: "localizado_propiedad", nombre: "propiedades", valor: m.localizado_propiedad },
      ] },
    { clave: "visitas", nombre: "Visitas y reuniones", valor: a.visitasHechas, auto: true,
      detalle: `${a.visitasAgendadas} agendadas para hoy` },
  ];

  return { fecha, numeros, crudos: { ...a, ...m } };
}

// Los totales de un rango, para el reporte.
async function delRango(desde, hasta) {
  const uno = async (sql, ...extra) => (await db.prepare(sql).get(desde, hasta, ...extra)).n;

  const contactos = await uno(
    "SELECT COUNT(*) n FROM contactos WHERE fecha BETWEEN ? AND ? AND tipo <> 'entrante' AND canal IN ('whatsapp','copia')"
  );
  const frio = await uno(
    "SELECT COUNT(*) n FROM contactos WHERE fecha BETWEEN ? AND ? AND tipo = 'frio' AND canal IN ('whatsapp','copia')"
  );
  const seguimientos = (
    await db
      .prepare(
        `SELECT COUNT(*) n FROM tildes t JOIN bloques b ON b.id = t.bloqueId
          WHERE t.fecha BETWEEN ? AND ? AND t.personaId IS NOT NULL AND b.tipo IN ('seguimientos','captacion')`
      )
      .get(desde, hasta)
  ).n;
  const meHablaron = (
    await db
      .prepare("SELECT COUNT(DISTINCT personaId) n FROM contactos WHERE fecha BETWEEN ? AND ? AND tipo = 'entrante'")
      .get(desde, hasta)
  ).n;
  const contestaron = (
    await db
      .prepare(
        `SELECT COUNT(DISTINCT c.personaId) n FROM contactos c
          WHERE c.fecha BETWEEN ? AND ? AND c.tipo = 'entrante'
            AND EXISTS (SELECT 1 FROM contactos f WHERE f.personaId = c.personaId AND f.tipo = 'frio')`
      )
      .get(desde, hasta)
  ).n;
  const calificados = (
    await db
      .prepare("SELECT COUNT(*) n FROM personas WHERE lista = 'calificado' AND actualizado BETWEEN ? AND ?")
      .get(desde, hasta)
  ).n;
  const visitasHechas = await uno("SELECT COUNT(*) n FROM agenda WHERE fecha BETWEEN ? AND ? AND hecho = 1");
  const visitasAgendadas = await uno("SELECT COUNT(*) n FROM agenda WHERE fecha BETWEEN ? AND ?");
  const cerrados = (
    await db.prepare("SELECT COUNT(*) n FROM personas WHERE cerrado = 1 AND cerradoFecha BETWEEN ? AND ?").get(desde, hasta)
  ).n;
  const nuevos = (await db.prepare("SELECT COUNT(*) n FROM personas WHERE creado BETWEEN ? AND ?").get(desde, hasta)).n;

  const manuales = {};
  for (const m of MANUALES) {
    manuales[m.clave] = (
      await db
        .prepare("SELECT COALESCE(SUM(valor), 0) n FROM contadores WHERE fecha BETWEEN ? AND ? AND clave = ?")
        .get(desde, hasta, m.clave)
    ).n;
  }

  return {
    desde, hasta, contactos, frio, seguimientos, meHablaron, contestaron,
    calificados, visitasHechas, visitasAgendadas, cerrados, nuevos,
    llamadas: manuales.llamada_captacion + manuales.llamada_venta,
    localizados: manuales.localizado_prospecto + manuales.localizado_propiedad,
    manuales,
  };
}

// De dónde salieron las fichas nuevas de un período. Es la pregunta que
// contesta si la publicidad sirve o si los referidos son los que traen.
async function porOrigen(desde, hasta) {
  const filas = await db
    .prepare(
      `SELECT COALESCE(origen, 'otro') origen, COUNT(*) n
         FROM personas WHERE creado BETWEEN ? AND ?
        GROUP BY COALESCE(origen, 'otro')`
    )
    .all(desde, hasta);

  const porGrupo = new Map();
  for (const f of filas) {
    const dato = O.POR_CLAVE.get(f.origen);
    const grupo = dato ? dato.grupo : "Otros";
    if (!porGrupo.has(grupo)) porGrupo.set(grupo, { grupo, total: 0, detalle: [] });
    const g = porGrupo.get(grupo);
    g.total += f.n;
    g.detalle.push({ nombre: O.nombreDe(f.origen), n: f.n });
  }
  for (const g of porGrupo.values()) g.detalle.sort((a, b) => b.n - a.n);

  return [...porGrupo.values()].sort((a, b) => b.total - a.total);
}

module.exports = { MANUALES, manual, sumar, automaticos, delDia, delRango, porOrigen };
