import React, { useState } from "react";
import { api, hoyLocal } from "../api.js";
import { Aviso } from "../componentes/Comunes.jsx";

const SUGERENCIAS = [
  "¿Por dónde empiezo hoy?",
  "¿A quién estoy descuidando?",
  "¿Qué captación se me puede caer este mes?",
  "¿Cómo vengo con la prospección de la semana?",
];

export default function Asistente() {
  const [pregunta, setPregunta] = useState("");
  const [hilo, setHilo] = useState([]);
  const [pensando, setPensando] = useState(false);
  const [error, setError] = useState("");

  async function preguntar(texto) {
    const q = (texto ?? pregunta).trim();
    if (!q) return;
    setPregunta(""); setPensando(true); setError("");
    setHilo((h) => [...h, { quien: "yo", texto: q }]);
    try {
      const d = await api.post("/ia/consultar", { pregunta: q, fecha: hoyLocal() });
      setHilo((h) => [...h, { quien: "ia", texto: d.texto }]);
    } catch (e) {
      setError(e.message);
    }
    setPensando(false);
  }

  return (
    <div className="contenido">
      <div className="encabezado">
        <div>
          <h1>Asistente</h1>
          <div className="sub">Ve tus cuatro listas, el día de hoy y los números. No escribe mensajes por vos.</div>
        </div>
        {hilo.length > 0 && <button className="btn plano chico" onClick={() => setHilo([])}>limpiar</button>}
      </div>

      <Aviso tipo="error" alCerrar={() => setError("")}>{error}</Aviso>

      {hilo.length === 0 && (
        <div className="fila-botones" style={{ marginTop: 16 }}>
          {SUGERENCIAS.map((s) => (
            <button key={s} className="btn chico" onClick={() => preguntar(s)}>{s}</button>
          ))}
        </div>
      )}

      <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 12 }}>
        {hilo.map((m, i) => (
          m.quien === "yo"
            ? <div key={i} className="meta-medio" style={{ fontWeight: 500 }}>{m.texto}</div>
            : <div key={i} className="resumen-linea texto-ia">{m.texto}</div>
        ))}
        {pensando && <div className="meta">pensando…</div>}
      </div>

      <div className="fila-botones" style={{ marginTop: 18 }}>
        <input type="text" placeholder="preguntale algo" value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && preguntar()} style={{ maxWidth: 520 }} />
        <button className="btn principal-btn" onClick={() => preguntar()} disabled={pensando}>Preguntar</button>
      </div>
    </div>
  );
}
