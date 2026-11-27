import React, { useEffect, useState } from "react";
import { api, corta, enPalabras, hoyLocal, sumarDias, NOMBRE_LISTA } from "../api.js";
import { Aviso, Chip, Tilde, Vacio } from "../componentes/Comunes.jsx";

export default function Agenda({ abrirFicha }) {
  const [citas, setCitas] = useState([]);
  const [error, setError] = useState("");
  const [nueva, setNueva] = useState({ fecha: hoyLocal(), hora: "11:00", minutos: 60, titulo: "", tipo: "visita", lugar: "", personaId: "" });
  const [gente, setGente] = useState([]);
  const [afuera, setAfuera] = useState([]);

  async function cargar() {
    try {
      const d = await api.get(`/agenda?desde=${sumarDias(hoyLocal(), -7)}&hasta=${sumarDias(hoyLocal(), 60)}`);
      setCitas(d.citas); setError("");
    } catch (e) { setError(e.message); }
  }
  useEffect(() => {
    cargar();
    api.get("/personas?orden=nombre").then((d) => setGente(d.personas)).catch(() => {});
  }, []);

  async function crear() {
    try {
      const d = await api.post("/agenda", { ...nueva, personaId: nueva.personaId || null, minutos: Number(nueva.minutos) });
      setAfuera(d.afuera || []);
      setNueva({ ...nueva, titulo: "", lugar: "", personaId: "" });
      cargar(); setError("");
    } catch (e) { setError(e.message); }
  }

  const porDia = citas.reduce((acc, c) => { (acc[c.fecha] = acc[c.fecha] || []).push(c); return acc; }, {});
  const dias = Object.keys(porDia).sort();

  return (
    <div className="contenido">
      <div className="encabezado">
        <div>
          <h1>Agenda</h1>
          <div className="sub">Lo que agendás acá corre los bloques del día solo.</div>
        </div>
      </div>

      <Aviso tipo="error" alCerrar={() => setError("")}>{error}</Aviso>
      {afuera.length > 0 && <Aviso alCerrar={() => setAfuera([])}>Con esa cita quedó fuera del día: {afuera.map((b) => b.nombre).join(", ")}.</Aviso>}

      <div className="lista" style={{ marginTop: 14, padding: 12 }}>
        <div className="rejilla">
          <label className="campo"><span>Fecha</span><input type="date" value={nueva.fecha} onChange={(e) => setNueva({ ...nueva, fecha: e.target.value })} /></label>
          <label className="campo"><span>Hora</span><input type="time" value={nueva.hora} onChange={(e) => setNueva({ ...nueva, hora: e.target.value })} /></label>
          <label className="campo"><span>Minutos</span><input type="number" min="15" step="15" value={nueva.minutos} onChange={(e) => setNueva({ ...nueva, minutos: e.target.value })} /></label>
          <label className="campo"><span>Tipo</span>
            <select value={nueva.tipo} onChange={(e) => setNueva({ ...nueva, tipo: e.target.value })}>
              <option value="visita">Visita</option><option value="reunion">Reunión</option>
            </select></label>
          <label className="campo"><span>Con quién</span>
            <select value={nueva.personaId} onChange={(e) => setNueva({ ...nueva, personaId: e.target.value })}>
              <option value="">—</option>
              {gente.map((p) => <option key={p.id} value={p.id}>{p.nombre} · {NOMBRE_LISTA[p.lista]}</option>)}
            </select></label>
          <label className="campo"><span>Título</span>
            <input type="text" placeholder="se completa con el nombre" value={nueva.titulo} onChange={(e) => setNueva({ ...nueva, titulo: e.target.value })} /></label>
          <label className="campo"><span>Dónde</span>
            <input type="text" value={nueva.lugar} onChange={(e) => setNueva({ ...nueva, lugar: e.target.value })} onKeyDown={(e) => e.key === "Enter" && crear()} /></label>
        </div>
        <div className="fila-botones" style={{ marginTop: 12 }}>
          <button className="btn principal-btn" onClick={crear}>Agendar</button>
        </div>
      </div>

      {dias.length === 0 ? (
        <div className="lista" style={{ marginTop: 14 }}><Vacio>No hay nada agendado.</Vacio></div>
      ) : dias.map((d) => (
        <div key={d} style={{ marginTop: 18 }}>
          <h2 style={{ marginBottom: 6 }}>{enPalabras(d)} <span className="sub">· {corta(d)}</span></h2>
          <div className="lista">
            {porDia[d].map((c) => (
              <div className={`fila ${c.hecho ? "hecha" : ""}`} key={c.id}>
                <Tilde marcado={!!c.hecho} alTildar={() => api.patch(`/agenda/${c.id}`, { hecho: !c.hecho }).then(cargar)} />
                <span className="meta" style={{ width: 46 }}>{c.hora}</span>
                <span className="nombre-fila crece recorta">{c.titulo}</span>
                {c.personaNombre && (
                  <span className="meta-medio recorta clickeable" style={{ width: 140 }} onClick={() => abrirFicha(c.personaId)}>{c.personaNombre}</span>
                )}
                {c.lugar && <span className="meta recorta" style={{ width: 130 }}>{c.lugar}</span>}
                <Chip>{c.tipo}</Chip>
                <button className="btn plano chico peligro" onClick={() => api.borrar(`/agenda/${c.id}`).then(cargar)}>sacar</button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
