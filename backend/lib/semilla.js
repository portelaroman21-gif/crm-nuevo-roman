"use strict";
const { db } = require("../db.js");

// Un punto de partida razonable. Todo esto se edita desde Plantilla.
const DIA_TIPICO = [
  { nombre: "Seguimientos", tipo: "seguimientos", hora: "09:00", minutos: 60, objetivo: null },
  { nombre: "Prospección en frío", tipo: "prospeccion", hora: "10:00", minutos: 90, objetivo: 20 },
  { nombre: "Captación", tipo: "captacion", hora: "11:30", minutos: 45, objetivo: null },
  { nombre: "Contenido", tipo: "contenido", hora: "15:00", minutos: 60, objetivo: 2 },
  { nombre: "Seguimientos de la tarde", tipo: "seguimientos", hora: "17:00", minutos: 30, objetivo: null },
];

async function sembrarPlantilla() {
  const hay = await db.prepare("SELECT COUNT(*) n FROM plantilla").get();
  if (hay.n > 0) return false;
  await db.transaccion(async (tx) => {
    const poner = tx.prepare(
      "INSERT INTO plantilla (ambito, dia, nombre, tipo, hora, minutos, objetivo) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    for (const b of DIA_TIPICO) await poner.run("dia", 0, b.nombre, b.tipo, b.hora, b.minutos, b.objetivo);
    for (let d = 1; d <= 5; d += 1)
      for (const b of DIA_TIPICO) await poner.run("semana", d, b.nombre, b.tipo, b.hora, b.minutos, b.objetivo);
  });
  return true;
}

module.exports = { sembrarPlantilla, DIA_TIPICO };
