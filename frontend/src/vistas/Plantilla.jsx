import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { Aviso, Vacio } from "../componentes/Comunes.jsx";

const DIAS = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const TIPOS = [
  ["seguimientos", "Seguimientos"], ["prospeccion", "Prospección"], ["captacion", "Captación"],
  ["visitas", "Visitas"], ["contenido", "Contenido"], ["suelto", "Suelto"],
];
const VACIO = { nombre: "", tipo: "seguimientos", hora: "09:00", minutos: 60, objetivo: "" };

export default function Plantilla() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [donde, setDonde] = useState({ ambito: "dia", dia: 0 });
  const [nuevo, setNuevo] = useState(VACIO);
  const [pegarEn, setPegarEn] = useState([1, 2, 3, 4, 5]);

  async function cargar() {
    try { setDatos(await api.get("/plantilla")); setError(""); }
    catch (e) { setError(e.message); }
  }
  useEffect(() => { cargar(); }, []);
  if (!datos) return <div className="contenido"><Aviso tipo="error">{error}</Aviso><div className="meta">Cargando…</div></div>;

  const actuales = donde.ambito === "dia" ? datos.diaTipico : datos.semana[donde.dia] || [];

  async function agregar() {
    try {
      await api.post("/plantilla", { ...donde, ...nuevo, objetivo: nuevo.objetivo === "" ? null : Number(nuevo.objetivo) });
      setNuevo(VACIO); cargar(); setError("");
    } catch (e) { setError(e.message); }
  }
  async function cambiar(id, cambios) {
    try { await api.patch(`/plantilla/${id}`, cambios); cargar(); }
    catch (e) { setError(e.message); }
  }
  async function pegar() {
    try {
      await api.post("/plantilla/pegar", { dias: pegarEn, reemplazar: true });
      setAviso(`Día típico pegado en ${pegarEn.map((d) => DIAS[d].toLowerCase()).join(", ")}.`);
      cargar();
    } catch (e) { setError(e.message); }
  }

  return (
    <div className="contenido">
      <div className="encabezado">
        <div>
          <h1>Plantilla</h1>
          <div className="sub">Un día típico para armar rápido, y la semana que se usa de verdad.</div>
        </div>
        <button className="btn chico" onClick={() => api.post("/plantilla/aplicar-adelante", {}).then(() => setAviso("Los días de mañana en adelante se vuelven a armar con esta plantilla."))}>
          Aplicar de mañana en adelante
        </button>
      </div>

      <Aviso tipo="error" alCerrar={() => setError("")}>{error}</Aviso>
      <Aviso tipo="ok" alCerrar={() => setAviso("")}>{aviso}</Aviso>

      <div className="pestanas" style={{ marginTop: 16 }}>
        <button className={`pestana ${donde.ambito === "dia" ? "activa" : ""}`} onClick={() => setDonde({ ambito: "dia", dia: 0 })}>
          Día típico
        </button>
        {[1, 2, 3, 4, 5, 6, 7].map((d) => (
          <button key={d} className={`pestana ${donde.ambito === "semana" && donde.dia === d ? "activa" : ""}`}
            onClick={() => setDonde({ ambito: "semana", dia: d })}>
            {DIAS[d]}
            <span className="meta" style={{ marginLeft: 5 }}>{(datos.semana[d] || []).length || ""}</span>
          </button>
        ))}
      </div>

      {donde.ambito === "dia" && (
        <div className="resumen-linea" style={{ marginBottom: 14 }}>
          <div style={{ marginBottom: 8 }}>Este día no se usa solo: se pega en los días de la semana que elijas.</div>
          <div className="fila-botones">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <button key={d} className={`btn chico ${pegarEn.includes(d) ? "principal-btn" : ""}`}
                onClick={() => setPegarEn(pegarEn.includes(d) ? pegarEn.filter((x) => x !== d) : [...pegarEn, d].sort())}>
                {DIAS[d].slice(0, 3)}
              </button>
            ))}
            <button className="btn chico" onClick={pegar} disabled={!pegarEn.length || !datos.diaTipico.length}>
              Pegar en {pegarEn.length} {pegarEn.length === 1 ? "día" : "días"}
            </button>
          </div>
        </div>
      )}

      <div className="lista">
        <div className="fila encabezado-fila">
          <span style={{ width: 104 }}>Hora</span>
          <span className="crece">Nombre</span>
          <span style={{ width: 130 }}>Tipo</span>
          <span style={{ width: 80 }}>Minutos</span>
          <span style={{ width: 86 }}>Objetivo</span>
          <span style={{ width: 46 }} />
        </div>
        {actuales.length === 0 ? (
          <Vacio>
            {donde.ambito === "dia" ? "El día típico está vacío." : `${DIAS[donde.dia]} no tiene bloques. Pegá el día típico o agregá uno abajo.`}
          </Vacio>
        ) : actuales.map((b) => (
          <div className="fila" key={b.id}>
            <input style={{ width: 104, height: 26 }} type="time" defaultValue={b.hora} onBlur={(e) => cambiar(b.id, { hora: e.target.value })} />
            <input className="crece" style={{ height: 26 }} type="text" defaultValue={b.nombre} onBlur={(e) => cambiar(b.id, { nombre: e.target.value })} />
            <select style={{ width: 130, height: 26 }} value={b.tipo} onChange={(e) => cambiar(b.id, { tipo: e.target.value })}>
              {TIPOS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
            </select>
            <input style={{ width: 80, height: 26 }} type="number" min="5" step="5" defaultValue={b.minutos} onBlur={(e) => cambiar(b.id, { minutos: Number(e.target.value) })} />
            <input style={{ width: 86, height: 26 }} type="number" min="0" placeholder="auto" defaultValue={b.objetivo ?? ""} onBlur={(e) => cambiar(b.id, { objetivo: e.target.value === "" ? null : Number(e.target.value) })} />
            <button className="btn plano chico peligro" style={{ width: 46 }} onClick={() => api.borrar(`/plantilla/${b.id}`).then(cargar)}>sacar</button>
          </div>
        ))}
        <div className="fila" style={{ background: "var(--fondo)" }}>
          <input style={{ width: 104, height: 26 }} type="time" value={nuevo.hora} onChange={(e) => setNuevo({ ...nuevo, hora: e.target.value })} />
          <input className="crece" style={{ height: 26 }} type="text" placeholder="nombre del bloque" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} onKeyDown={(e) => e.key === "Enter" && agregar()} />
          <select style={{ width: 130, height: 26 }} value={nuevo.tipo} onChange={(e) => setNuevo({ ...nuevo, tipo: e.target.value })}>
            {TIPOS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
          </select>
          <input style={{ width: 80, height: 26 }} type="number" min="5" step="5" value={nuevo.minutos} onChange={(e) => setNuevo({ ...nuevo, minutos: Number(e.target.value) })} />
          <input style={{ width: 86, height: 26 }} type="number" min="0" placeholder="auto" value={nuevo.objetivo} onChange={(e) => setNuevo({ ...nuevo, objetivo: e.target.value })} />
          <button className="btn chico principal-btn" style={{ width: 46 }} onClick={agregar}>+</button>
        </div>
      </div>
      <div className="sub" style={{ marginTop: 10 }}>
        El objetivo vacío se calcula solo: cuántos entran en el tiempo del bloque.
        Los retoques de un día puntual se hacen en Hoy y no tocan esta plantilla.
      </div>
    </div>
  );
}
