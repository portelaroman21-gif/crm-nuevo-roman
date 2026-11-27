"use strict";
const { enrutador } = require("../lib/ruta.js");
const { db } = require("../db.js");
const F = require("../lib/fechas.js");
const D = require("../lib/dia.js");

const r = enrutador();

r.get("/", async (req, res) => {
  const diaTipico = await D.plantillaDe("dia", 0);
  const semana = {};
  for (let d = 1; d <= 7; d += 1) semana[d] = await D.plantillaDe("semana", d);
  res.json({ diaTipico, semana, dias: F.DIAS, tipos: D.TIPOS });
});

function validar(b) {
  if (!b || !b.nombre || !String(b.nombre).trim()) return "Falta el nombre del bloque";
  if (!D.TIPOS.includes(b.tipo)) return "Tipo de bloque desconocido";
  if (!F.esHora(b.hora)) return "La hora va como HH:MM";
  if (!Number(b.minutos) || Number(b.minutos) < 5) return "El bloque necesita al menos 5 minutos";
  return null;
}

r.post("/", async (req, res) => {
  const { ambito, dia, nombre, tipo, hora, minutos, objetivo } = req.body || {};
  if (!["dia", "semana"].includes(ambito)) return res.status(400).json({ error: "Ámbito desconocido" });
  const numeroDia = ambito === "dia" ? 0 : Number(dia);
  if (ambito === "semana" && !(numeroDia >= 1 && numeroDia <= 7))
    return res.status(400).json({ error: "Día de la semana inválido" });
  const problema = validar({ nombre, tipo, hora, minutos });
  if (problema) return res.status(400).json({ error: problema });
  const info = await db
    .prepare("INSERT INTO plantilla (ambito, dia, nombre, tipo, hora, minutos, objetivo) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(ambito, numeroDia, String(nombre).trim(), tipo, hora, Number(minutos), objetivo == null || objetivo === "" ? null : Number(objetivo));
  res.json({ bloque: await db.prepare("SELECT * FROM plantilla WHERE id = ?").get(info.lastInsertRowid) });
});

r.patch("/:id", async (req, res) => {
  const fila = await db.prepare("SELECT * FROM plantilla WHERE id = ?").get(Number(req.params.id));
  if (!fila) return res.status(404).json({ error: "No existe ese bloque" });
  const nuevo = {
    nombre: req.body.nombre === undefined ? fila.nombre : String(req.body.nombre).trim(),
    tipo: req.body.tipo === undefined ? fila.tipo : req.body.tipo,
    hora: req.body.hora === undefined ? fila.hora : req.body.hora,
    minutos: req.body.minutos === undefined ? fila.minutos : Number(req.body.minutos),
  };
  const problema = validar(nuevo);
  if (problema) return res.status(400).json({ error: problema });
  const objetivo =
    req.body.objetivo === undefined ? fila.objetivo : req.body.objetivo === "" || req.body.objetivo === null ? null : Number(req.body.objetivo);
  await db.prepare("UPDATE plantilla SET nombre = ?, tipo = ?, hora = ?, minutos = ?, objetivo = ? WHERE id = ?")
    .run(nuevo.nombre, nuevo.tipo, nuevo.hora, nuevo.minutos, objetivo, fila.id);
  res.json({ bloque: await db.prepare("SELECT * FROM plantilla WHERE id = ?").get(fila.id) });
});

r.delete("/:id", async (req, res) => {
  await db.prepare("DELETE FROM plantilla WHERE id = ?").run(Number(req.params.id));
  res.json({ ok: true });
});

// Pegar el dia tipico en uno o varios dias de la semana.
r.post("/pegar", async (req, res) => {
  const { dias, reemplazar = true } = req.body || {};
  const destino = Array.isArray(dias) ? dias.map(Number).filter((d) => d >= 1 && d <= 7) : [];
  if (!destino.length) return res.status(400).json({ error: "Elegí al menos un día" });
  const tipico = await D.plantillaDe("dia", 0);
  if (!tipico.length) return res.status(400).json({ error: "El día típico está vacío" });

  await db.transaccion(async (tx) => {
    for (const d of destino) {
      if (reemplazar) await tx.prepare("DELETE FROM plantilla WHERE ambito = 'semana' AND dia = ?").run(d);
      for (const b of tipico) {
        await tx
          .prepare(
            "INSERT INTO plantilla (ambito, dia, nombre, tipo, hora, minutos, objetivo) VALUES ('semana', ?, ?, ?, ?, ?, ?)"
          )
          .run(d, b.nombre, b.tipo, b.hora, b.minutos, b.objetivo);
      }
    }
  });
  const semana = {};
  for (let d = 1; d <= 7; d += 1) semana[d] = await D.plantillaDe("semana", d);
  res.json({ semana });
});

// Volver a aplicar la plantilla a los dias futuros que todavia no se tocaron.
r.post("/aplicar-adelante", async (req, res) => {
  const desde = F.esFecha((req.body || {}).desde) ? req.body.desde : F.sumarDias(F.hoy(), 1);
  const borrados = await db
    .prepare("DELETE FROM bloques WHERE fecha >= ? AND agendaId IS NULL AND id NOT IN (SELECT bloqueId FROM tildes)")
    .run(desde);
  await db.prepare("UPDATE dias SET armado = 0 WHERE fecha >= ? AND cerrado = 0").run(desde);
  res.json({ ok: true, bloquesRehechos: borrados.changes, desde });
});

module.exports = r;
