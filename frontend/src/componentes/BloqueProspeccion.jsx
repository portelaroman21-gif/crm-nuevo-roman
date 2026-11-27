import React, { useState } from "react";
import { api, copiar, linkWhatsapp } from "../api.js";
import { Aviso, ChipOrigen, SelectorOrigen, Tilde } from "./Comunes.jsx";

const VACIO = { nombre: "", telefono: "", origen: "", origenNota: "", lista: "lead" };

// El bloque de prospección: cargás lo que vas encontrando y queda pendiente
// de contacto. Lo que cargues acá entra también a la cola de seguimientos.
export default function BloqueProspeccion({ bloque, alCambiar, abrirFicha, irA }) {
  const [nuevo, setNuevo] = useState(VACIO);
  const [error, setError] = useState("");
  const [duplicado, setDuplicado] = useState(null);
  const [guardando, setGuardando] = useState(false);

  async function agregar() {
    if (!nuevo.nombre.trim()) { setError("Falta el nombre"); return; }
    if (!nuevo.origen) { setError("Elegí de dónde salió: define si cuenta como prospección en frío"); return; }
    setError(""); setDuplicado(null); setGuardando(true);
    try {
      await api.post("/personas", nuevo);
      setNuevo({ ...VACIO, origen: nuevo.origen, lista: nuevo.lista });
      alCambiar();
    } catch (e) {
      setError(e.message);
      if (e.datos && e.datos.duplicado) setDuplicado(e.datos.duplicado);
    }
    setGuardando(false);
  }

  async function contactar(persona, canal) {
    if (canal === "whatsapp") {
      const l = linkWhatsapp(persona.telefono);
      if (l) window.open(l, "_blank", "noopener");
    } else {
      await copiar(persona.telefono);
    }
    await api.post("/dia/tildar", { bloqueId: bloque.id, personaId: persona.id, canal });
    alCambiar();
  }

  return (
    <>
      <div className="fila" style={{ minHeight: 42 }}>
        <span className="crece">
          Objetivo: <b>{bloque.cupo ?? "sin fijar"}</b> en frío ·
          {" "}cargaste <b style={{ color: "var(--acento)" }}>{bloque.cargadosHoy ?? 0}</b> hoy ·
          {" "}contactaste <b style={{ color: "var(--acento)" }}>{bloque.hechosHoy ?? 0}</b> en frío
        </span>
        <button className="btn plano chico" onClick={() => irA("numeros")}>Sumar llamadas y localizados</button>
      </div>

      <div style={{ padding: "10px 10px 12px", borderBottom: "1px solid var(--borde)" }}>
        {error && (
          <Aviso tipo="error" alCerrar={() => setError("")}>
            {error}
            {duplicado && (
              <> · <a style={{ cursor: "pointer" }} onClick={() => abrirFicha(duplicado.id)}>abrir la ficha de {duplicado.nombre}</a></>
            )}
          </Aviso>
        )}
        <div className="rejilla" style={{ gridTemplateColumns: "1.4fr 1fr 1.4fr 0.8fr auto", alignItems: "end", gap: 8 }}>
          <label className="campo"><span>Nombre</span>
            <input type="text" value={nuevo.nombre} placeholder="quién es"
              onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && agregar()} /></label>
          <label className="campo"><span>Teléfono</span>
            <input type="text" value={nuevo.telefono} placeholder="11 5555-6666"
              onChange={(e) => setNuevo({ ...nuevo, telefono: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && agregar()} /></label>
          <SelectorOrigen
            valor={nuevo.origen}
            alCambiar={(v) => setNuevo({ ...nuevo, origen: v })}
          />
          <label className="campo"><span>Para</span>
            <select value={nuevo.lista} onChange={(e) => setNuevo({ ...nuevo, lista: e.target.value })}>
              <option value="lead">Venta</option>
              <option value="captacion">Captación</option>
            </select></label>
          <button className="btn principal-btn" onClick={agregar} disabled={guardando} style={{ height: 30 }}>
            {guardando ? "…" : "Agregar"}
          </button>
        </div>
        {nuevo.origen === "otro" && (
          <div style={{ marginTop: 8, maxWidth: 300 }}>
            <label className="campo"><span>Cuál origen</span>
              <input type="text" value={nuevo.origenNota} placeholder="escribilo"
                onChange={(e) => setNuevo({ ...nuevo, origenNota: e.target.value })} /></label>
          </div>
        )}
      </div>

      {bloque.items.length === 0 ? (
        <div className="vacio">Todo lo que cargues acá queda pendiente de contacto hasta que le escribas.</div>
      ) : (
        bloque.items.map((p) => (
          <div className="fila" key={p.id}>
            <Tilde marcado={false} alTildar={() => contactar(p, "otro")} titulo="Marcar como contactado" />
            <span className="nombre-fila recorta clickeable" style={{ width: 170 }} onClick={() => abrirFicha(p.id)}>
              {p.nombre}
            </span>
            <span className="crece recorta meta-medio">{p.queQuiere || p.direccion || "—"}</span>
            <ChipOrigen origen={p.origen} />
            <span className="meta" style={{ width: 110 }}>{p.telefono || "sin teléfono"}</span>
            {p.telefono && (
              <div className="fila-botones">
                <button className="btn chico" onClick={() => contactar(p, "whatsapp")}>WhatsApp</button>
                <button className="btn chico" onClick={() => contactar(p, "copia")}>Copiar</button>
              </div>
            )}
          </div>
        ))
      )}
    </>
  );
}
