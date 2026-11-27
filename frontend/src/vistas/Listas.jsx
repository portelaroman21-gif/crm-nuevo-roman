import React, { useEffect, useState } from "react";
import { api, NOMBRE_LISTA, SINGULAR_LISTA, corta } from "../api.js";
import { Aviso, Chip, Vacio } from "../componentes/Comunes.jsx";

const COLUMNA_PROPIA = {
  lead: ["queQuiere", "Qué quiere"],
  calificado: ["zona", "Zona"],
  captacion: ["direccion", "Dirección"],
  desarrollador: ["empresa", "Empresa"],
};

export default function Listas({ lista, abrirFicha, recargarClave }) {
  const [personas, setPersonas] = useState([]);
  const [buscar, setBuscar] = useState("");
  const [verFrios, setVerFrios] = useState(false);
  const [error, setError] = useState("");
  const [nueva, setNueva] = useState(null);

  async function cargar() {
    try {
      const d = await api.get(
        `/personas?lista=${lista}&buscar=${encodeURIComponent(buscar)}&frio=${verFrios ? "1" : "0"}`
      );
      setPersonas(d.personas); setError("");
    } catch (e) { setError(e.message); }
  }

  useEffect(() => { const t = setTimeout(cargar, buscar ? 220 : 0); return () => clearTimeout(t); },
    [lista, buscar, verFrios, recargarClave]);

  const [extra, etiquetaExtra] = COLUMNA_PROPIA[lista];

  return (
    <div className="contenido">
      <div className="encabezado">
        <div>
          <h1>{NOMBRE_LISTA[lista]}</h1>
          <div className="sub">{personas.length} {verFrios ? "en frío" : "activos"}</div>
        </div>
        <div className="fila-botones">
          <input type="text" placeholder="buscar" value={buscar} onChange={(e) => setBuscar(e.target.value)} style={{ width: 180 }} />
          <button className={`btn chico ${verFrios ? "principal-btn" : ""}`} onClick={() => setVerFrios(!verFrios)}>
            {verFrios ? "ver activos" : "ver fríos"}
          </button>
          <button className="btn chico principal-btn" onClick={() => setNueva({ lista, nombre: "", telefono: "" })}>
            Nuevo {SINGULAR_LISTA[lista].toLowerCase()}
          </button>
        </div>
      </div>

      <Aviso tipo="error" alCerrar={() => setError("")}>{error}</Aviso>

      {nueva && <NuevaFicha datos={nueva} alCambiar={setNueva} alCerrar={() => setNueva(null)} alCrear={(id) => { setNueva(null); cargar(); abrirFicha(id); }} />}

      <div className="lista" style={{ marginTop: 14 }}>
        <div className="fila encabezado-fila">
          <span style={{ width: 180 }}>Nombre</span>
          <span className="crece">{etiquetaExtra}</span>
          <span style={{ width: 120 }}>Teléfono</span>
          <span style={{ width: 96 }}>Vuelve</span>
        </div>
        {personas.length === 0 ? (
          <Vacio acciones={<button className="btn chico principal-btn" onClick={() => setNueva({ lista, nombre: "", telefono: "" })}>Cargar el primero</button>}>
            {buscar ? "No hay nadie que coincida con esa búsqueda." : `Todavía no hay nadie en ${NOMBRE_LISTA[lista].toLowerCase()}.`}
          </Vacio>
        ) : personas.map((p) => (
          <div className="fila clickeable" key={p.id} onClick={() => abrirFicha(p.id)}>
            <span className="nombre-fila recorta" style={{ width: 180 }}>{p.nombre}</span>
            <span className="crece recorta meta-medio">{p[extra] || p.queQuiere || "—"}</span>
            <span className="meta" style={{ width: 120 }}>{p.telefono || "—"}</span>
            <span style={{ width: 96, display: "flex", gap: 5, alignItems: "center" }}>
              {p.importante ? <Chip tipo="acento">!</Chip> : null}
              {p.frio
                ? <Chip tipo="frio">frío</Chip>
                : p.atraso > 0
                  ? <Chip tipo={p.atraso > 5 ? "alerta" : ""}>{p.atraso}d</Chip>
                  : <span className="meta">{corta(p.proximoContacto)}</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function NuevaFicha({ datos, alCambiar, alCerrar, alCrear }) {
  const [error, setError] = useState("");
  const [duplicado, setDuplicado] = useState(null);

  async function guardar() {
    setError(""); setDuplicado(null);
    try {
      const d = await api.post("/personas", datos);
      alCrear(d.persona.id);
    } catch (e) {
      setError(e.message);
      if (e.datos && e.datos.duplicado) setDuplicado(e.datos.duplicado);
    }
  }

  return (
    <div className="lista" style={{ marginTop: 14, padding: 14 }}>
      <h2 style={{ marginBottom: 10 }}>Nuevo {SINGULAR_LISTA[datos.lista].toLowerCase()}</h2>
      {error && (
        <Aviso tipo="error">
          {error}
          {duplicado && <> · <a onClick={() => alCrear(duplicado.id)} style={{ cursor: "pointer" }}>abrir la ficha de {duplicado.nombre}</a></>}
        </Aviso>
      )}
      <div className="rejilla">
        <label className="campo"><span>Nombre</span>
          <input autoFocus type="text" value={datos.nombre} onChange={(e) => alCambiar({ ...datos, nombre: e.target.value })} /></label>
        <label className="campo"><span>Teléfono</span>
          <input type="text" value={datos.telefono} onChange={(e) => alCambiar({ ...datos, telefono: e.target.value })} placeholder="11 5555-6666" /></label>
        <label className="campo"><span>De dónde salió</span>
          <input type="text" value={datos.origen || ""} onChange={(e) => alCambiar({ ...datos, origen: e.target.value })} placeholder="Instagram, cartel, referido" /></label>
        <label className="campo"><span>Qué quiere, en una línea</span>
          <input type="text" value={datos.queQuiere || ""} onChange={(e) => alCambiar({ ...datos, queQuiere: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && guardar()} /></label>
      </div>
      <div className="fila-botones" style={{ marginTop: 12 }}>
        <button className="btn principal-btn" onClick={guardar}>Guardar</button>
        <button className="btn plano" onClick={alCerrar}>cancelar</button>
        <span className="meta">Los demás campos aparecen en la ficha, cuando hagan falta.</span>
      </div>
    </div>
  );
}
