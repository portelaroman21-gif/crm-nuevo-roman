"use strict";
const { enrutador } = require("../lib/ruta.js");
const { db } = require("../db.js");
const F = require("../lib/fechas.js");
const P = require("../lib/personas.js");
const O = require("../lib/origenes.js");

const r = enrutador();

r.get("/", async (req, res) => {
  const { lista, buscar, frio, cerrado, orden } = req.query;
  const donde = [];
  const args = [];
  if (lista && P.LISTAS.includes(lista)) { donde.push("lista = ?"); args.push(lista); }
  if (frio === "1") donde.push("frio = 1");
  else if (frio === "0") donde.push("frio = 0");
  if (cerrado === "1") donde.push("cerrado = 1");
  else if (cerrado !== "todos") donde.push("cerrado = 0");
  if (buscar && String(buscar).trim()) {
    const t = `%${String(buscar).trim().toLowerCase()}%`;
    donde.push(
      "(LOWER(nombre) LIKE ? OR LOWER(COALESCE(telefono,'')) LIKE ? OR LOWER(COALESCE(empresa,'')) LIKE ? OR LOWER(COALESCE(direccion,'')) LIKE ? OR LOWER(COALESCE(queQuiere,'')) LIKE ?)"
    );
    args.push(t, t, t, t, t);
  }
  const sql = `SELECT * FROM personas ${donde.length ? "WHERE " + donde.join(" AND ") : ""}`;
  let filas = await db.prepare(sql).all(...args);
  const hoy = F.hoy();
  filas = filas.map((p) => ({
    ...p,
    atraso: p.proximoContacto ? Math.max(0, F.diferenciaDias(p.proximoContacto, hoy)) : 0,
  }));
  if (orden === "nombre") filas.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  else if (orden === "nuevos") filas.sort((a, b) => b.id - a.id);
  else filas.sort((a, b) => b.importante - a.importante || b.atraso - a.atraso || a.nombre.localeCompare(b.nombre, "es"));
  res.json({ personas: filas });
});

r.get("/resumen", async (req, res) => {
  const hoy = F.hoy();
  const filas = await db
    .prepare(
      `SELECT lista,
              COUNT(*) total,
              SUM(CASE WHEN frio = 1 THEN 1 ELSE 0 END) frios,
              SUM(CASE WHEN frio = 0 AND proximoContacto <= ? THEN 1 ELSE 0 END) paraHoy
         FROM personas WHERE cerrado = 0 GROUP BY lista`
    )
    .all(hoy);
  const porLista = {};
  for (const l of P.LISTAS) porLista[l] = { total: 0, frios: 0, paraHoy: 0, nombre: P.NOMBRE_LISTA[l] };
  for (const f of filas) porLista[f.lista] = { ...porLista[f.lista], total: f.total, frios: f.frios, paraHoy: f.paraHoy };
  res.json({ porLista });
});

r.get("/origenes", (req, res) => {
  res.json({
    origenes: O.ORIGENES.map((o) => ({ clave: o.clave, nombre: o.nombre, grupo: o.grupo, frio: o.frio })),
    grupos: O.GRUPOS,
  });
});

r.get("/buscar-telefono", async (req, res) => {
  const persona = await P.porTelefono(req.query.telefono || "");
  res.json({ persona });
});

r.get("/:id", async (req, res) => {
  const persona = await P.porId(req.params.id);
  if (!persona) return res.status(404).json({ error: "No existe esa ficha" });
  const citas = await db.prepare("SELECT * FROM agenda WHERE personaId = ? ORDER BY fecha DESC, hora").all(persona.id);
  const mapa = await db.prepare("SELECT * FROM eventos_mapa WHERE personaId = ? ORDER BY ts DESC LIMIT 20").all(persona.id);
  res.json({ persona, historial: await P.historial(persona.id), agenda: citas, mapa });
});

r.post("/", async (req, res) => {
  try {
    res.json({ persona: await P.crear(req.body || {}) });
  } catch (e) {
    if (e.duplicado) return res.status(409).json({ error: e.message, duplicado: e.duplicado });
    res.status(400).json({ error: e.message });
  }
});

r.patch("/:id", async (req, res) => {
  try {
    const persona = await P.actualizar(req.params.id, req.body || {});
    if (!persona) return res.status(404).json({ error: "No existe esa ficha" });
    res.json({ persona });
  } catch (e) {
    if (e.duplicado) return res.status(409).json({ error: e.message, duplicado: e.duplicado });
    res.status(400).json({ error: e.message });
  }
});

r.delete("/:id", async (req, res) => {
  const persona = await P.porId(req.params.id);
  if (!persona) return res.status(404).json({ error: "No existe esa ficha" });
  await db.prepare("DELETE FROM personas WHERE id = ?").run(persona.id);
  res.json({ ok: true });
});

// Un contacto hecho desde la ficha: abrir WhatsApp o copiar el numero cuentan igual.
r.post("/:id/contacto", async (req, res) => {
  const { canal = "whatsapp", nota = null } = req.body || {};
  if (!["whatsapp", "copia", "llamada", "otro"].includes(canal))
    return res.status(400).json({ error: "Canal desconocido" });
  const r2 = await P.registrarContacto(req.params.id, { canal, nota });
  if (!r2) return res.status(404).json({ error: "No existe esa ficha" });
  res.json(r2);
});

r.post("/:id/me-hablo", async (req, res) => {
  const persona = await P.registrarEntrante(req.params.id, (req.body || {}).nota || null);
  if (!persona) return res.status(404).json({ error: "No existe esa ficha" });
  res.json({ persona });
});

r.post("/:id/frio", async (req, res) => {
  const dias = Number((req.body || {}).dias) || P.DIAS_DE_FRIO;
  res.json({ persona: await P.enfriar(req.params.id, dias) });
});

r.post("/:id/activar", async (req, res) => {
  res.json({ persona: await P.descongelar(req.params.id) });
});

r.post("/:id/cerrar", async (req, res) => {
  const { monto = null } = req.body || {};
  await db.prepare(
    "UPDATE personas SET cerrado = 1, cerradoFecha = ?, cerradoMonto = ?, actualizado = ? WHERE id = ?"
  ).run(F.hoy(), monto, F.hoy(), Number(req.params.id));
  res.json({ persona: await P.porId(req.params.id) });
});

r.post("/:id/pasar", async (req, res) => {
  const { lista } = req.body || {};
  if (!P.LISTAS.includes(lista)) return res.status(400).json({ error: "Lista desconocida" });
  try {
    res.json({ persona: await P.actualizar(req.params.id, { lista }) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = r;
