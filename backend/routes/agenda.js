"use strict";
const { enrutador } = require("../lib/ruta.js");
const { db } = require("../db.js");
const F = require("../lib/fechas.js");
const D = require("../lib/dia.js");
const P = require("../lib/personas.js");

const r = enrutador();

r.get("/", async (req, res) => {
  const desde = F.esFecha(req.query.desde) ? req.query.desde : F.hoy();
  const hasta = F.esFecha(req.query.hasta) ? req.query.hasta : F.sumarDias(desde, 30);
  const citas = await db
    .prepare(
      `SELECT a.*, p.nombre personaNombre, p.telefono personaTelefono, p.lista personaLista
         FROM agenda a LEFT JOIN personas p ON p.id = a.personaId
        WHERE a.fecha BETWEEN ? AND ? ORDER BY a.fecha, a.hora`
    )
    .all(desde, hasta);
  res.json({ citas, desde, hasta });
});

r.post("/", async (req, res) => {
  const { fecha, hora, minutos = 60, titulo, tipo = "visita", personaId = null, lugar = null } = req.body || {};
  if (!F.esFecha(fecha) || !F.esHora(hora)) return res.status(400).json({ error: "Fecha u hora inválida" });
  const persona = personaId ? await P.porId(personaId) : null;
  const nombre = String(titulo || "").trim() || (persona ? `${tipo === "reunion" ? "Reunión" : "Visita"} con ${persona.nombre}` : "");
  if (!nombre) return res.status(400).json({ error: "Falta el título" });
  const info = await db
    .prepare(
      "INSERT INTO agenda (fecha, hora, minutos, titulo, tipo, personaId, lugar, creado) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .run(fecha, hora, Number(minutos) || 60, nombre, tipo === "reunion" ? "reunion" : "visita", persona ? persona.id : null, lugar, F.hoy());
  const afuera = await D.armar(fecha) && await D.sincronizarAgenda(fecha);
  res.json({ cita: await db.prepare("SELECT * FROM agenda WHERE id = ?").get(info.lastInsertRowid), afuera });
});

r.patch("/:id", async (req, res) => {
  const cita = await db.prepare("SELECT * FROM agenda WHERE id = ?").get(Number(req.params.id));
  if (!cita) return res.status(404).json({ error: "No existe esa cita" });
  const cambios = {};
  for (const campo of ["titulo", "lugar", "resultado"]) {
    if (req.body[campo] !== undefined) cambios[campo] = String(req.body[campo] || "").trim() || null;
  }
  if (req.body.fecha !== undefined && F.esFecha(req.body.fecha)) cambios.fecha = req.body.fecha;
  if (req.body.hora !== undefined && F.esHora(req.body.hora)) cambios.hora = req.body.hora;
  if (req.body.minutos !== undefined && Number(req.body.minutos) > 0) cambios.minutos = Number(req.body.minutos);
  if (req.body.hecho !== undefined) cambios.hecho = req.body.hecho ? 1 : 0;
  if (Object.keys(cambios).length) {
    const sets = Object.keys(cambios).map((c) => `${c} = @${c}`).join(", ");
    await db.prepare(`UPDATE agenda SET ${sets} WHERE id = @id`).run({ ...cambios, id: cita.id });
  }
  const nueva = await db.prepare("SELECT * FROM agenda WHERE id = ?").get(cita.id);
  if (cambios.fecha && cambios.fecha !== cita.fecha) {
    await db.prepare("DELETE FROM bloques WHERE agendaId = ?").run(cita.id);
    await D.armar(cita.fecha); await D.sincronizarAgenda(cita.fecha);
  }
  await D.armar(nueva.fecha);
  const afuera = await D.sincronizarAgenda(nueva.fecha);
  res.json({ cita: nueva, afuera });
});

r.delete("/:id", async (req, res) => {
  const cita = await db.prepare("SELECT * FROM agenda WHERE id = ?").get(Number(req.params.id));
  if (!cita) return res.status(404).json({ error: "No existe esa cita" });
  await db.prepare("DELETE FROM agenda WHERE id = ?").run(cita.id);
  await D.sincronizarAgenda(cita.fecha);
  res.json({ ok: true });
});

module.exports = r;
