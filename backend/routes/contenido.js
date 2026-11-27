"use strict";
const { enrutador } = require("../lib/ruta.js");
const { db } = require("../db.js");
const F = require("../lib/fechas.js");

const ETAPAS = ["idea", "guion", "grabado", "editado", "publicado"];
const r = enrutador();

r.get("/", async (req, res) => {
  const piezas = await db
    .prepare("SELECT * FROM contenido ORDER BY COALESCE(fechaObjetivo,'9999'), id")
    .all();
  res.json({ piezas, etapas: ETAPAS });
});

r.post("/", async (req, res) => {
  const { titulo, etapa = "idea", formato = null, fechaObjetivo = null, nota = null } = req.body || {};
  if (!titulo || !String(titulo).trim()) return res.status(400).json({ error: "Falta el título" });
  const info = await db
    .prepare(
      "INSERT INTO contenido (titulo, etapa, formato, fechaObjetivo, nota, creado, actualizado) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .run(
      String(titulo).trim(),
      ETAPAS.includes(etapa) ? etapa : "idea",
      formato, F.esFecha(fechaObjetivo) ? fechaObjetivo : null, nota, F.hoy(), F.hoy()
    );
  res.json({ pieza: await db.prepare("SELECT * FROM contenido WHERE id = ?").get(info.lastInsertRowid) });
});

r.patch("/:id", async (req, res) => {
  const pieza = await db.prepare("SELECT * FROM contenido WHERE id = ?").get(Number(req.params.id));
  if (!pieza) return res.status(404).json({ error: "No existe" });
  const cambios = { actualizado: F.hoy() };
  if (req.body.titulo !== undefined) cambios.titulo = String(req.body.titulo).trim() || pieza.titulo;
  if (req.body.etapa !== undefined && ETAPAS.includes(req.body.etapa)) cambios.etapa = req.body.etapa;
  if (req.body.formato !== undefined) cambios.formato = String(req.body.formato || "").trim() || null;
  if (req.body.link !== undefined) cambios.link = String(req.body.link || "").trim() || null;
  if (req.body.nota !== undefined) cambios.nota = String(req.body.nota || "").trim() || null;
  if (req.body.fechaObjetivo !== undefined)
    cambios.fechaObjetivo = F.esFecha(req.body.fechaObjetivo) ? req.body.fechaObjetivo : null;
  const sets = Object.keys(cambios).map((c) => `${c} = @${c}`).join(", ");
  await db.prepare(`UPDATE contenido SET ${sets} WHERE id = @id`).run({ ...cambios, id: pieza.id });
  res.json({ pieza: await db.prepare("SELECT * FROM contenido WHERE id = ?").get(pieza.id) });
});

r.delete("/:id", async (req, res) => {
  await db.prepare("DELETE FROM contenido WHERE id = ?").run(Number(req.params.id));
  res.json({ ok: true });
});

module.exports = r;
