"use strict";
const { enrutador } = require("../lib/ruta.js");
const { db } = require("../db.js");
const F = require("../lib/fechas.js");
const D = require("../lib/dia.js");
const P = require("../lib/personas.js");
const C = require("../lib/contadores.js");

const r = enrutador();

function fechaDe(req) {
  const f = req.query.fecha || (req.body || {}).fecha;
  return F.esFecha(f) ? f : F.hoy();
}

r.get("/", async (req, res) => {
  const fecha = fechaDe(req);
  const dia = await D.delDia(fecha);
  const numeros = await C.delDia(fecha);
  const pendientes = (await P.cola(fecha)).length;
  const hechos = numeros.crudos.seguimientos;
  res.json({ ...dia, hoy: F.hoy(), hora: F.horaDe(), numeros: numeros.numeros, pendientes, hechos });
});

r.post("/tildar", async (req, res) => {
  const { bloqueId, personaId, contenidoId, texto, canal, nota } = req.body || {};
  if (!bloqueId) return res.status(400).json({ error: "Falta el bloque" });
  const hecho = await D.tildar(bloqueId, { personaId, contenidoId, texto, canal, nota });
  if (!hecho) return res.status(404).json({ error: "No existe ese bloque" });
  res.json(hecho);
});

r.post("/destildar", async (req, res) => {
  const { bloqueId, personaId } = req.body || {};
  res.json({ ok: await D.destildar(bloqueId, personaId) });
});

// Bloques sueltos del dia: agregar uno sin tocar la plantilla.
r.post("/bloques", async (req, res) => {
  const fecha = fechaDe(req);
  const { nombre, tipo, hora, minutos, objetivo } = req.body || {};
  if (!nombre || !D.TIPOS.includes(tipo) || !F.esHora(hora) || !Number(minutos))
    return res.status(400).json({ error: "Faltan datos del bloque" });
  const info = await db
    .prepare("INSERT INTO bloques (fecha, nombre, tipo, hora, minutos, objetivo, fijo) VALUES (?, ?, ?, ?, ?, ?, 0)")
    .run(fecha, String(nombre).trim(), tipo, hora, Number(minutos), objetivo == null ? null : Number(objetivo));
  await D.reacomodar(fecha);
  res.json({ bloque: await db.prepare("SELECT * FROM bloques WHERE id = ?").get(info.lastInsertRowid) });
});

r.patch("/bloques/:id", async (req, res) => {
  const bloque = await db.prepare("SELECT * FROM bloques WHERE id = ?").get(Number(req.params.id));
  if (!bloque) return res.status(404).json({ error: "No existe ese bloque" });
  const { nombre, hora, minutos, objetivo, tipo } = req.body || {};
  const cambios = {};
  if (nombre !== undefined) cambios.nombre = String(nombre).trim() || bloque.nombre;
  if (hora !== undefined && F.esHora(hora)) cambios.hora = hora;
  if (minutos !== undefined && Number(minutos) > 0) cambios.minutos = Number(minutos);
  if (objetivo !== undefined) cambios.objetivo = objetivo === null || objetivo === "" ? null : Number(objetivo);
  if (tipo !== undefined && D.TIPOS.includes(tipo) && !bloque.agendaId) cambios.tipo = tipo;
  if (Object.keys(cambios).length) {
    const sets = Object.keys(cambios).map((c) => `${c} = @${c}`).join(", ");
    await db.prepare(`UPDATE bloques SET ${sets} WHERE id = @id`).run({ ...cambios, id: bloque.id });
  }
  const afuera = await D.reacomodar(bloque.fecha);
  res.json({ bloque: await db.prepare("SELECT * FROM bloques WHERE id = ?").get(bloque.id), afuera });
});

r.delete("/bloques/:id", async (req, res) => {
  const bloque = await db.prepare("SELECT * FROM bloques WHERE id = ?").get(Number(req.params.id));
  if (!bloque) return res.status(404).json({ error: "No existe ese bloque" });
  if (bloque.agendaId) return res.status(400).json({ error: "Ese bloque sale de la agenda. Sacá la cita." });
  await db.prepare("DELETE FROM bloques WHERE id = ?").run(bloque.id);
  res.json({ ok: true });
});

// Volver a armar el dia desde la plantilla, perdiendo los retoques del dia.
r.post("/rearmar", async (req, res) => {
  const fecha = fechaDe(req);
  await db.prepare("DELETE FROM bloques WHERE fecha = ? AND agendaId IS NULL").run(fecha);
  await db.prepare("UPDATE dias SET armado = 0 WHERE fecha = ?").run(fecha);
  await D.armar(fecha);
  res.json(await D.delDia(fecha));
});

// Tareas sueltas.
r.post("/sueltos", async (req, res) => {
  const fecha = fechaDe(req);
  const { texto, bloqueId = null } = req.body || {};
  if (!texto || !String(texto).trim()) return res.status(400).json({ error: "Falta el texto" });
  const info = await db
    .prepare("INSERT INTO sueltos (fecha, bloqueId, texto, creado) VALUES (?, ?, ?, ?)")
    .run(fecha, bloqueId ? Number(bloqueId) : null, String(texto).trim(), F.hoy());
  res.json({ suelto: await db.prepare("SELECT * FROM sueltos WHERE id = ?").get(info.lastInsertRowid) });
});

r.patch("/sueltos/:id", async (req, res) => {
  const { hecho, texto } = req.body || {};
  const suelto = await db.prepare("SELECT * FROM sueltos WHERE id = ?").get(Number(req.params.id));
  if (!suelto) return res.status(404).json({ error: "No existe" });
  await db.prepare("UPDATE sueltos SET hecho = ?, texto = ? WHERE id = ?").run(
    hecho === undefined ? suelto.hecho : hecho ? 1 : 0,
    texto === undefined ? suelto.texto : String(texto).trim() || suelto.texto,
    suelto.id
  );
  res.json({ suelto: await db.prepare("SELECT * FROM sueltos WHERE id = ?").get(suelto.id) });
});

r.delete("/sueltos/:id", async (req, res) => {
  await db.prepare("DELETE FROM sueltos WHERE id = ?").run(Number(req.params.id));
  res.json({ ok: true });
});

// Lo que no se termino no se pierde: queda a la vista al cerrar el dia.
r.post("/cerrar", async (req, res) => {
  const fecha = fechaDe(req);
  await db.prepare(
    "INSERT INTO dias (fecha, armado, cerrado, nota) VALUES (?, 1, 1, ?) ON CONFLICT(fecha) DO UPDATE SET cerrado = 1, nota = excluded.nota"
  ).run(fecha, (req.body || {}).nota || null);
  const manana = F.sumarDias(fecha, 1);
  res.json({
    ok: true,
    pendientes: (await P.cola(fecha)).length,
    manana: (await P.cola(manana)).length,
  });
});

module.exports = r;
