"use strict";
const fs = require("fs");
const path = require("path");
const { db } = require("../db.js");
const F = require("./fechas.js");

// Postgres ya tiene sus propios respaldos del lado del servicio, pero una copia
// en JSON al volumen no cuesta nada y se puede volver a importar a mano.
const CARPETA = process.env.RESPALDOS_DIR || "/respaldos";
const CUANTOS = 14;
const TABLAS = [
  "usuarios", "personas", "contactos", "plantilla", "dias", "bloques",
  "tildes", "sueltos", "agenda", "contenido", "contadores", "eventos_mapa", "config",
];

async function respaldar() {
  try {
    fs.mkdirSync(CARPETA, { recursive: true });
  } catch (e) {
    // Sin volumen montado no hay respaldo en archivo, y está bien:
    // Postgres tiene los suyos. No es motivo para romper nada.
    throw new Error(`no hay dónde escribir (${CARPETA}): ${e.message}`);
  }
  const contenido = { fecha: F.hoy(), tablas: {} };
  for (const tabla of TABLAS) {
    contenido.tablas[tabla] = await db.prepare(`SELECT * FROM ${tabla}`).all();
  }
  const destino = path.join(CARPETA, `crm-${F.hoy()}.json`);
  fs.writeFileSync(destino, JSON.stringify(contenido));

  const viejos = fs
    .readdirSync(CARPETA)
    .filter((n) => n.startsWith("crm-") && n.endsWith(".json"))
    .sort()
    .reverse()
    .slice(CUANTOS);
  for (const n of viejos) {
    try { fs.unlinkSync(path.join(CARPETA, n)); } catch { /* si no se puede, no importa */ }
  }
  return destino;
}

function arrancarRespaldos() {
  const correr = () => {
    respaldar()
      .then((d) => console.log("Respaldo listo:", d))
      .catch((e) => console.error("No se pudo respaldar:", e.message));
  };
  setTimeout(correr, 15000);
  setInterval(correr, 24 * 60 * 60 * 1000).unref();
}

module.exports = { respaldar, arrancarRespaldos, CARPETA };
