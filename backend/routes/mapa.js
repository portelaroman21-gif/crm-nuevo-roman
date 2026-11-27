"use strict";
const { enrutador } = require("../lib/ruta.js");
const { db, leerConfig } = require("../db.js");
const F = require("../lib/fechas.js");
const P = require("../lib/personas.js");

const r = enrutador();

// El mapa manda un webhook con una clave compartida. Si no hay clave configurada,
// la puerta queda cerrada: no se acepta nada.
async function claveValida(req) {
  const esperada = process.env.MAPA_CLAVE || await leerConfig("mapa_clave", "");
  if (!esperada) return false;
  const vino = req.get("X-Clave") || req.query.clave || "";
  return String(vino) === String(esperada);
}

r.post("/evento", async (req, res) => {
  if (!(await claveValida(req))) return res.status(401).json({ error: "Clave del mapa incorrecta" });
  const { tipo, nombre, telefono, email, empresa, rol, tipoLote, zona, superficie, detalle } = req.body || {};
  if (!["registro", "lote_guardado", "visita"].includes(tipo))
    return res.status(400).json({ error: "Tipo de evento desconocido" });

  let persona = await P.porTelefono(telefono || "");

  if (!persona && tipo === "registro" && (nombre || empresa)) {
    try {
      persona = await P.crear({
        lista: "desarrollador",
        nombre: String(nombre || empresa).trim(),
        telefono: telefono || null,
        origen: "mapa de zonificación",
        empresa: empresa || null,
        rol: rol || null,
        tipoLote: tipoLote || null,
        zona: zona || null,
        superficie: superficie || null,
        queQuiere: [tipoLote, zona, superficie].filter(Boolean).join(" · ") || null,
        origenMapa: 1,
      });
    } catch (e) {
      persona = e.duplicado || null;
    }
  }

  await db.prepare("INSERT INTO eventos_mapa (tipo, personaId, detalle, ts) VALUES (?, ?, ?, ?)").run(
    tipo, persona ? persona.id : null,
    detalle || [nombre, empresa, email, tipoLote, zona].filter(Boolean).join(" · ") || null,
    F.ahora()
  );

  // Alguien que vuelve al mapa esta pensando en comprar ahora: sube al frente de la cola.
  if (persona && (tipo === "visita" || tipo === "lote_guardado")) {
    const anterior = await db
      .prepare("SELECT ts FROM eventos_mapa WHERE personaId = ? AND id <> (SELECT MAX(id) FROM eventos_mapa) ORDER BY ts DESC LIMIT 1")
      .get(persona.id);
    const quieto = !anterior || F.ahora() - anterior.ts > 7 * 86400000;
    if (quieto || tipo === "lote_guardado") {
      await db.prepare("UPDATE personas SET proximoContacto = ?, frio = 0, actualizado = ? WHERE id = ?")
        .run(F.hoy(), F.hoy(), persona.id);
    }
  }

  res.json({ ok: true, personaId: persona ? persona.id : null });
});

module.exports = r;
