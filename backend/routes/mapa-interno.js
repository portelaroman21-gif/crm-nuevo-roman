"use strict";
const { enrutador } = require("../lib/ruta.js");
const { db, leerConfig, guardarConfig } = require("../db.js");
const crypto = require("crypto");

const r = enrutador();

r.get("/config", async (req, res) => {
  let clave = process.env.MAPA_CLAVE || await leerConfig("mapa_clave", "");
  res.json({ clave, url: await leerConfig("mapa_url", "https://mapa.romanportela.com"), fija: !!process.env.MAPA_CLAVE });
});

r.post("/config", async (req, res) => {
  if (req.body.url !== undefined) await guardarConfig("mapa_url", String(req.body.url || "").trim());
  if (req.body.generar) await guardarConfig("mapa_clave", crypto.randomBytes(16).toString("hex"));
  else if (req.body.clave !== undefined) await guardarConfig("mapa_clave", String(req.body.clave || "").trim());
  res.json({ clave: await leerConfig("mapa_clave", ""), url: await leerConfig("mapa_url", "") });
});

r.get("/eventos", async (req, res) => {
  const filas = await db
    .prepare(
      `SELECT e.*, p.nombre personaNombre FROM eventos_mapa e
         LEFT JOIN personas p ON p.id = e.personaId
        ORDER BY e.ts DESC LIMIT 100`
    )
    .all();
  res.json({ eventos: filas });
});

module.exports = r;
