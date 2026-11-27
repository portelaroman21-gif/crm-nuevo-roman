"use strict";
const { enrutador } = require("../lib/ruta.js");
const F = require("../lib/fechas.js");
const IA = require("../lib/ia.js");

const r = enrutador();

r.get("/config", async (req, res) => {
  const c = await IA.configuracion();
  res.json({ baseUrl: c.baseUrl, modelo: c.modelo, configurada: c.configurada });
});

r.post("/config", async (req, res) => {
  const c = await IA.guardar(req.body || {});
  res.json({ baseUrl: c.baseUrl, modelo: c.modelo, configurada: c.configurada });
});

// Guarda primero y despues prueba, para que no diga "falta la key" con el campo lleno.
r.post("/probar", async (req, res) => {
  try {
    if (req.body && (req.body.apiKey || req.body.modelo || req.body.baseUrl)) await IA.guardar(req.body);
    const texto = await IA.probar();
    res.json({ ok: true, texto });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

r.get("/panorama", async (req, res) => {
  const fecha = F.esFecha(req.query.fecha) ? req.query.fecha : F.hoy();
  res.json({ texto: await IA.panorama(fecha) });
});

r.post("/empezar", async (req, res) => {
  try {
    const fecha = F.esFecha((req.body || {}).fecha) ? req.body.fecha : F.hoy();
    res.json({ texto: await IA.porDondeEmpezar(fecha) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/consultar", async (req, res) => {
  const pregunta = String((req.body || {}).pregunta || "").trim();
  if (!pregunta) return res.status(400).json({ error: "Escribí la pregunta" });
  try {
    const fecha = F.esFecha((req.body || {}).fecha) ? req.body.fecha : F.hoy();
    res.json({ texto: await IA.consultar(pregunta, fecha) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = r;
