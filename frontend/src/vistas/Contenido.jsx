import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { Aviso, Vacio } from "../componentes/Comunes.jsx";

const ETAPAS = [["idea", "Idea"], ["guion", "Guion"], ["grabado", "Grabado"], ["editado", "Editado"], ["publicado", "Publicado"]];

export default function Contenido() {
  const [piezas, setPiezas] = useState([]);
  const [error, setError] = useState("");
  const [nueva, setNueva] = useState({ titulo: "", formato: "", fechaObjetivo: "" });

  async function cargar() {
    try { setPiezas((await api.get("/contenido")).piezas); setError(""); }
    catch (e) { setError(e.message); }
  }
  useEffect(() => { cargar(); }, []);

  async function crear() {
    if (!nueva.titulo.trim()) return;
    try { await api.post("/contenido", nueva); setNueva({ titulo: "", formato: "", fechaObjetivo: "" }); cargar(); }
    catch (e) { setError(e.message); }
  }

  const pendientes = piezas.filter((p) => p.etapa !== "publicado");
  const publicadas = piezas.filter((p) => p.etapa === "publicado");

  return (
    <div className="contenido">
      <div className="encabezado">
        <div>
          <h1>Contenido</h1>
          <div className="sub">{pendientes.length} en curso · {publicadas.length} publicadas</div>
        </div>
      </div>

      <Aviso tipo="error" alCerrar={() => setError("")}>{error}</Aviso>

      <div className="lista" style={{ marginTop: 14, padding: 12 }}>
        <div className="rejilla">
          <label className="campo"><span>Idea</span>
            <input type="text" value={nueva.titulo} placeholder="de qué va el video" onChange={(e) => setNueva({ ...nueva, titulo: e.target.value })} onKeyDown={(e) => e.key === "Enter" && crear()} /></label>
          <label className="campo"><span>Formato</span>
            <input type="text" value={nueva.formato} placeholder="reel, short, carrusel" onChange={(e) => setNueva({ ...nueva, formato: e.target.value })} /></label>
          <label className="campo"><span>Para cuándo</span>
            <input type="date" value={nueva.fechaObjetivo} onChange={(e) => setNueva({ ...nueva, fechaObjetivo: e.target.value })} /></label>
        </div>
        <div className="fila-botones" style={{ marginTop: 12 }}>
          <button className="btn principal-btn" onClick={crear}>Agregar</button>
        </div>
      </div>

      <div className="lista" style={{ marginTop: 16 }}>
        <div className="fila encabezado-fila">
          <span className="crece">Pieza</span>
          <span style={{ width: 120 }}>Etapa</span>
          <span style={{ width: 110 }}>Formato</span>
          <span style={{ width: 120 }}>Para cuándo</span>
          <span style={{ width: 46 }} />
        </div>
        {piezas.length === 0 ? (
          <Vacio>Todavía no cargaste ninguna idea.</Vacio>
        ) : piezas.map((p) => (
          <div className={`fila ${p.etapa === "publicado" ? "hecha" : ""}`} key={p.id}>
            <input className="crece" style={{ height: 26 }} type="text" defaultValue={p.titulo}
              onBlur={(e) => api.patch(`/contenido/${p.id}`, { titulo: e.target.value }).then(cargar)} />
            <select style={{ width: 120, height: 26 }} value={p.etapa} onChange={(e) => api.patch(`/contenido/${p.id}`, { etapa: e.target.value }).then(cargar)}>
              {ETAPAS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
            </select>
            <input style={{ width: 110, height: 26 }} type="text" defaultValue={p.formato || ""}
              onBlur={(e) => api.patch(`/contenido/${p.id}`, { formato: e.target.value }).then(cargar)} />
            <input style={{ width: 120, height: 26 }} type="date" defaultValue={p.fechaObjetivo || ""}
              onBlur={(e) => api.patch(`/contenido/${p.id}`, { fechaObjetivo: e.target.value }).then(cargar)} />
            <button className="btn plano chico peligro" style={{ width: 46 }} onClick={() => api.borrar(`/contenido/${p.id}`).then(cargar)}>sacar</button>
          </div>
        ))}
      </div>
    </div>
  );
}
