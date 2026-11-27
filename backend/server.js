"use strict";
const path = require("path");
const fs = require("fs");
const express = require("express");

const { db, pool, preparar } = require("./db.js");
const A = require("./lib/auth.js");
const F = require("./lib/fechas.js");
const { sembrarPlantilla } = require("./lib/semilla.js");
const { arrancarRespaldos } = require("./lib/respaldo.js");

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "20mb" }));

// El webhook del mapa entra con su propia clave, antes de la puerta de sesión.
app.use("/api/mapa", require("./routes/mapa.js"));

app.use("/api/sesion", require("./routes/sesion.js"));
app.get("/api/salud", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, base: "postgres", fecha: F.hoy(), hora: F.horaDe() });
  } catch (e) {
    res.status(503).json({ ok: false, error: `Sin base: ${e.message}` });
  }
});

app.use("/api/personas", A.puerta, require("./routes/personas.js"));
app.use("/api/dia", A.puerta, require("./routes/dia.js"));
app.use("/api/plantilla", A.puerta, require("./routes/plantilla.js"));
app.use("/api/agenda", A.puerta, require("./routes/agenda.js"));
app.use("/api/numeros", A.puerta, require("./routes/numeros.js"));
app.use("/api/contenido", A.puerta, require("./routes/contenido.js"));
app.use("/api/ia", A.puerta, require("./routes/ia.js"));
app.use("/api/conexion-mapa", A.puerta, require("./routes/mapa-interno.js"));
app.use("/api/importar", A.puerta, require("./routes/importar.js"));

app.use("/api", (req, res) => res.status(404).json({ error: "Ruta desconocida" }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Algo se rompió del lado del servidor" });
});

const ESTATICO = path.join(__dirname, "publico");
if (fs.existsSync(ESTATICO)) {
  app.use(express.static(ESTATICO, { maxAge: "1h", index: false }));
  app.get("*", (req, res) => res.sendFile(path.join(ESTATICO, "index.html")));
}

const PUERTO = Number(process.env.PORT) || 3000;

(async () => {
  try {
    await preparar();
    await sembrarPlantilla();
  } catch (e) {
    console.error("No se pudo preparar la base:", e.message);
    process.exit(1);
  }

  arrancarRespaldos();

  app.listen(PUERTO, "0.0.0.0", async () => {
    console.log(`CRM Román Portela escuchando en ${PUERTO}`);
    const { n } = await db.prepare("SELECT COUNT(*) n FROM usuarios").get();
    if (!n) console.log("Todavía no hay usuario: entrá al sistema y creá el tuyo.");
  });
})();

for (const senal of ["SIGINT", "SIGTERM"]) {
  process.on(senal, async () => {
    try { await pool.end(); } catch { /* ya estaba cerrado */ }
    process.exit(0);
  });
}
