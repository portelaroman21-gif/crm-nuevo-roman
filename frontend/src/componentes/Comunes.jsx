import React, { useEffect, useState } from "react";
import { cargarOrigenes, copiar, linkWhatsapp } from "../api.js";

export function Aviso({ tipo = "", children, alCerrar }) {
  if (!children) return null;
  return (
    <div className={`aviso ${tipo}`}>
      <div className="fila-botones" style={{ justifyContent: "space-between" }}>
        <span>{children}</span>
        {alCerrar && <button className="btn plano chico" onClick={alCerrar}>cerrar</button>}
      </div>
    </div>
  );
}

export function Campo({ etiqueta, children }) {
  return (
    <label className="campo">
      <span>{etiqueta}</span>
      {children}
    </label>
  );
}

export function Texto({ etiqueta, valor, alCambiar, ...resto }) {
  return (
    <Campo etiqueta={etiqueta}>
      <input type="text" value={valor ?? ""} onChange={(e) => alCambiar(e.target.value)} {...resto} />
    </Campo>
  );
}

export function Tilde({ marcado, alTildar, titulo }) {
  return (
    <button
      type="button"
      className={`tilde ${marcado ? "si" : ""}`}
      onClick={alTildar}
      title={titulo || (marcado ? "Destildar" : "Marcar como hecho")}
      aria-pressed={marcado}
    />
  );
}

export function Vacio({ children, acciones }) {
  return (
    <div className="vacio">
      <div>{children}</div>
      {acciones && <div className="fila-botones">{acciones}</div>}
    </div>
  );
}

export function Panel({ titulo, subtitulo, alCerrar, pie, children }) {
  useEffect(() => {
    const escape = (e) => { if (e.key === "Escape") alCerrar(); };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [alCerrar]);

  return (
    <>
      <div className="telon" onClick={alCerrar} />
      <aside className="panel">
        <div className="panel-cabeza">
          <div className="crece">
            <h2>{titulo}</h2>
            {subtitulo && <div className="sub">{subtitulo}</div>}
          </div>
          <button className="btn plano" onClick={alCerrar}>cerrar</button>
        </div>
        <div className="panel-cuerpo">{children}</div>
        {pie && <div className="panel-pie">{pie}</div>}
      </aside>
    </>
  );
}

// Los dos botones que cuentan igual: abrir WhatsApp o llevarse el número.
export function BotonesContacto({ telefono, alContactar, compacto = false, texto = "" }) {
  const [copiado, setCopiado] = useState(false);
  if (!telefono) return <span className="meta">sin teléfono</span>;
  const link = linkWhatsapp(telefono, texto);

  return (
    <div className="fila-botones">
      <button
        className={`btn ${compacto ? "chico" : ""}`}
        onClick={() => {
          if (link) window.open(link, "_blank", "noopener");
          alContactar("whatsapp");
        }}
      >
        WhatsApp
      </button>
      <button
        className={`btn ${compacto ? "chico" : ""}`}
        onClick={async () => {
          await copiar(telefono);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 1400);
          alContactar("copia");
        }}
      >
        {copiado ? "copiado" : "Copiar número"}
      </button>
    </div>
  );
}

export function Chip({ children, tipo = "" }) {
  return <span className={`chip ${tipo}`}>{children}</span>;
}

// De dónde salió el lead. No es una etiqueta decorativa: define si cuenta
// como prospección en frío o como un contacto que te llegó.
export function SelectorOrigen({ valor, nota, alCambiar, alCambiarNota, etiqueta = "De dónde salió" }) {
  const [catalogo, setCatalogo] = useState(null);

  useEffect(() => {
    let vivo = true;
    cargarOrigenes().then((d) => { if (vivo) setCatalogo(d); }).catch(() => {});
    return () => { vivo = false; };
  }, []);

  const grupos = catalogo ? catalogo.grupos : [];
  const esOtro = valor === "otro";

  return (
    <>
      <Campo etiqueta={etiqueta}>
        <select value={valor || ""} onChange={(e) => alCambiar(e.target.value)}>
          <option value="">— elegí —</option>
          {grupos.map((g) => (
            <optgroup key={g} label={g}>
              {catalogo.origenes.filter((o) => o.grupo === g).map((o) => (
                <option key={o.clave} value={o.clave}>{o.nombre}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </Campo>
      {esOtro && alCambiarNota && (
        <Campo etiqueta="Cuál">
          <input type="text" value={nota || ""} placeholder="escribilo" onChange={(e) => alCambiarNota(e.target.value)} />
        </Campo>
      )}
    </>
  );
}

// Un cartel chico que dice si ese origen es prospección en frío.
export function ChipOrigen({ origen }) {
  const [catalogo, setCatalogo] = useState(null);
  useEffect(() => {
    let vivo = true;
    cargarOrigenes().then((d) => { if (vivo) setCatalogo(d); }).catch(() => {});
    return () => { vivo = false; };
  }, []);
  if (!origen || !catalogo) return null;
  const dato = catalogo.origenes.find((o) => o.clave === origen);
  if (!dato) return <Chip>{origen}</Chip>;
  return <Chip tipo={dato.frio ? "acento" : ""}>{dato.nombre}</Chip>;
}
