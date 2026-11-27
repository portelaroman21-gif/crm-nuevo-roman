import React, { useEffect, useState } from "react";
import { api, NOMBRE_LISTA, SINGULAR_LISTA, corta, enPalabras } from "../api.js";
import { Aviso, BotonesContacto, Campo, Chip, Panel, Texto } from "./Comunes.jsx";

const CAMPOS = {
  lead: [],
  calificado: [
    ["operacion", "Operación"], ["zona", "Zona"], ["rango", "Rango"],
    ["plazo", "Plazo"], ["mostrado", "Qué le mostraste"],
  ],
  captacion: [
    ["direccion", "Dirección"], ["tipoPropiedad", "Tipo"], ["precioPretendido", "Precio pretendido"],
    ["zona", "Zona"], ["exclusivoHasta", "Exclusivo hasta", "date"],
  ],
  desarrollador: [
    ["empresa", "Empresa"], ["rol", "Rol"], ["tipoLote", "Tipo de lote"],
    ["zona", "Zona"], ["superficie", "Superficie"],
  ],
};

export default function Ficha({ personaId, alCerrar, alCambiar }) {
  const [datos, setDatos] = useState(null);
  const [borrador, setBorrador] = useState({});
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  async function cargar() {
    try {
      const d = await api.get(`/personas/${personaId}`);
      setDatos(d);
      setBorrador(d.persona);
    } catch (e) { setError(e.message); }
  }

  useEffect(() => { cargar(); }, [personaId]);

  if (!datos) {
    return <Panel titulo="Ficha" alCerrar={alCerrar}>{error ? <Aviso tipo="error">{error}</Aviso> : <div className="meta">Cargando…</div>}</Panel>;
  }

  const p = datos.persona;

  async function guardar(cambios) {
    try {
      const d = await api.patch(`/personas/${p.id}`, cambios);
      setDatos((v) => ({ ...v, persona: d.persona }));
      setBorrador(d.persona);
      setError("");
      alCambiar && alCambiar();
    } catch (e) { setError(e.message); }
  }

  async function contactar(canal) {
    await api.post(`/personas/${p.id}/contacto`, { canal, nota: borrador.proximoPaso || null });
    setAviso(canal === "copia" ? "Número copiado y contacto contado" : "Contacto contado");
    cargar();
    alCambiar && alCambiar();
  }

  async function accion(ruta, cuerpo) {
    try {
      await api.post(`/personas/${p.id}/${ruta}`, cuerpo || {});
      cargar();
      alCambiar && alCambiar();
    } catch (e) { setError(e.message); }
  }

  const siguiente = { lead: "calificado", calificado: null, captacion: null, desarrollador: null }[p.lista];

  return (
    <Panel
      titulo={p.nombre}
      subtitulo={`${NOMBRE_LISTA[p.lista]}${p.frio ? " · en frío" : ""}${p.cerrado ? " · cerrado" : ""}`}
      alCerrar={alCerrar}
      pie={
        <>
          <BotonesContacto telefono={p.telefono} alContactar={contactar} compacto />
          <button className="btn chico" onClick={() => accion("me-hablo")}>Me escribió</button>
          {p.frio
            ? <button className="btn chico" onClick={() => accion("activar")}>Sacar de frío</button>
            : <button className="btn chico" onClick={() => accion("frio")}>Pasar a frío</button>}
          {!p.cerrado && <button className="btn chico" onClick={() => accion("cerrar")}>Marcar cerrado</button>}
        </>
      }
    >
      <Aviso tipo="error" alCerrar={() => setError("")}>{error}</Aviso>
      <Aviso tipo="ok" alCerrar={() => setAviso("")}>{aviso}</Aviso>

      <div className="fila-botones" style={{ marginBottom: 14 }}>
        {p.importante ? <Chip tipo="acento">importante</Chip> : null}
        {p.sinRespuesta > 0 ? <Chip tipo={p.sinRespuesta >= 4 ? "alerta" : ""}>{p.sinRespuesta} sin respuesta</Chip> : null}
        {p.origenMapa ? <Chip>del mapa</Chip> : null}
        {p.proximoContacto ? <Chip>vuelve el {corta(p.proximoContacto)}</Chip> : null}
      </div>

      <div className="rejilla dos" style={{ marginBottom: 12 }}>
        <Texto etiqueta="Nombre" valor={borrador.nombre} alCambiar={(v) => setBorrador({ ...borrador, nombre: v })} onBlur={() => guardar({ nombre: borrador.nombre })} />
        <Texto etiqueta="Teléfono" valor={borrador.telefono} alCambiar={(v) => setBorrador({ ...borrador, telefono: v })} onBlur={() => guardar({ telefono: borrador.telefono })} />
        <Texto etiqueta="De dónde salió" valor={borrador.origen} alCambiar={(v) => setBorrador({ ...borrador, origen: v })} onBlur={() => guardar({ origen: borrador.origen })} />
        <Campo etiqueta="Lista">
          <select value={p.lista} onChange={(e) => accion("pasar", { lista: e.target.value })}>
            {Object.keys(NOMBRE_LISTA).map((l) => <option key={l} value={l}>{SINGULAR_LISTA[l]}</option>)}
          </select>
        </Campo>
      </div>

      <div style={{ marginBottom: 12 }}>
        <Texto etiqueta="Qué quiere, en una línea" valor={borrador.queQuiere} alCambiar={(v) => setBorrador({ ...borrador, queQuiere: v })} onBlur={() => guardar({ queQuiere: borrador.queQuiere })} />
      </div>

      {CAMPOS[p.lista].length > 0 && (
        <div className="rejilla dos" style={{ marginBottom: 12 }}>
          {CAMPOS[p.lista].map(([clave, etiqueta, tipo]) => (
            <Campo key={clave} etiqueta={etiqueta}>
              <input
                type={tipo || "text"}
                value={borrador[clave] ?? ""}
                onChange={(e) => setBorrador({ ...borrador, [clave]: e.target.value })}
                onBlur={() => guardar({ [clave]: borrador[clave] })}
              />
            </Campo>
          ))}
          {p.lista === "captacion" && (
            <Campo etiqueta="Con otra inmobiliaria">
              <select value={p.conOtra ? "1" : "0"} onChange={(e) => guardar({ conOtra: e.target.value === "1" })}>
                <option value="0">No</option>
                <option value="1">Sí</option>
              </select>
            </Campo>
          )}
          {p.lista === "desarrollador" && (
            <Campo etiqueta="Tiene obra en marcha">
              <select value={p.obraEnMarcha ? "1" : "0"} onChange={(e) => guardar({ obraEnMarcha: e.target.value === "1" })}>
                <option value="0">No</option>
                <option value="1">Sí</option>
              </select>
            </Campo>
          )}
        </div>
      )}

      <div className="rejilla dos" style={{ marginBottom: 12 }}>
        <Texto etiqueta="Próximo paso" valor={borrador.proximoPaso} alCambiar={(v) => setBorrador({ ...borrador, proximoPaso: v })} onBlur={() => guardar({ proximoPaso: borrador.proximoPaso })} placeholder="una línea, no un párrafo" />
        <Campo etiqueta="Vuelve a la cola el">
          <input type="date" value={borrador.proximoContacto ?? ""} onChange={(e) => guardar({ proximoContacto: e.target.value })} />
        </Campo>
      </div>

      <div className="fila-botones" style={{ marginBottom: 18 }}>
        <button className="btn chico" onClick={() => guardar({ importante: !p.importante })}>
          {p.importante ? "Sacar de importantes" : "Marcar importante"}
        </button>
        {siguiente && <button className="btn chico principal-btn" onClick={() => accion("pasar", { lista: siguiente })}>Calificar</button>}
      </div>

      {datos.agenda.length > 0 && (
        <>
          <h3 style={{ marginBottom: 6 }}>Agenda</h3>
          <div className="lista" style={{ marginBottom: 18 }}>
            {datos.agenda.map((c) => (
              <div className="fila" key={c.id}>
                <span className="meta" style={{ width: 70 }}>{corta(c.fecha)} {c.hora}</span>
                <span className="crece recorta">{c.titulo}</span>
                {c.hecho ? <Chip>hecha</Chip> : null}
              </div>
            ))}
          </div>
        </>
      )}

      {datos.mapa.length > 0 && (
        <>
          <h3 style={{ marginBottom: 6 }}>Movimientos en el mapa</h3>
          <div className="lista" style={{ marginBottom: 18 }}>
            {datos.mapa.map((e) => (
              <div className="fila" key={e.id}>
                <span className="meta" style={{ width: 92 }}>{e.tipo.replace("_", " ")}</span>
                <span className="crece recorta meta-medio">{e.detalle || "—"}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <h3 style={{ marginBottom: 6 }}>Historial</h3>
      {datos.historial.length === 0 ? (
        <div className="meta">Todavía no hay contactos registrados.</div>
      ) : (
        <div className="lista">
          {datos.historial.map((h) => (
            <div className="fila" key={h.id}>
              <span className="meta" style={{ width: 54 }}>{corta(h.fecha)}</span>
              <span className="meta" style={{ width: 78 }}>
                {h.tipo === "entrante" ? "me escribió" : h.canal === "copia" ? "copiado" : h.canal}
              </span>
              <span className="crece recorta meta-medio">{h.nota || (h.tipo === "frio" ? "primer contacto" : "seguimiento")}</span>
            </div>
          ))}
        </div>
      )}
      <div className="sub" style={{ marginTop: 10 }}>Cargada el {enPalabras(p.creado)}.</div>
    </Panel>
  );
}
