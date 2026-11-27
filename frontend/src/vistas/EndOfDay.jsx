import React, { useEffect, useState } from "react";
import { api, enPalabras, hoyLocal, sumarDias } from "../api.js";
import { Aviso } from "../componentes/Comunes.jsx";

export default function EndOfDay() {
  const [fecha, setFecha] = useState(hoyLocal());
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [cerrado, setCerrado] = useState(null);

  async function cargar() {
    try { setDatos(await api.get(`/numeros/dia?fecha=${fecha}`)); setError(""); }
    catch (e) { setError(e.message); }
  }
  useEffect(() => { cargar(); setCerrado(null); }, [fecha]);

  async function sumar(clave, paso) {
    try { await api.post("/numeros/sumar", { clave, paso, fecha }); cargar(); }
    catch (e) { setError(e.message); }
  }

  async function cerrarDia() {
    try { setCerrado(await api.post("/dia/cerrar", { fecha })); cargar(); }
    catch (e) { setError(e.message); }
  }

  if (!datos) return <div className="contenido"><Aviso tipo="error">{error}</Aviso><div className="meta">Cargando…</div></div>;

  return (
    <div className="contenido">
      <div className="encabezado">
        <div>
          <h1>End of Day</h1>
          <div className="sub">{enPalabras(fecha)}</div>
        </div>
        <div className="fila-botones">
          <button className="btn plano chico" onClick={() => setFecha(sumarDias(fecha, -1))}>anterior</button>
          {fecha !== hoyLocal() && <button className="btn plano chico" onClick={() => setFecha(hoyLocal())}>hoy</button>}
          <button className="btn plano chico" onClick={() => setFecha(sumarDias(fecha, 1))}>siguiente</button>
        </div>
      </div>

      <Aviso tipo="error" alCerrar={() => setError("")}>{error}</Aviso>

      <div className="numeros" style={{ marginTop: 14 }}>
        {datos.numeros.map((n, i) => (
          <div className={`numero ${i === 0 ? "destacado" : ""}`} key={n.clave}>
            <div className="valor">{n.valor}</div>
            <div className="titulo">{n.nombre}</div>
            <div className="detalle">{n.detalle || (n.auto ? "" : "lo sumás vos")}</div>
            {!n.auto && n.partes && (
              <div className="partes">
                {n.partes.map((p) => (
                  <div className="parte" key={p.clave}>
                    <span className="nombre-parte">{p.nombre}</span>
                    <button className="paso-btn" onClick={() => sumar(p.clave, -1)} title="restar uno">−</button>
                    <b>{p.valor}</b>
                    <button className="paso-btn" onClick={() => sumar(p.clave, 1)} title="sumar uno">+</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="resumen-linea" style={{ marginTop: 16 }}>
        {datos.pendientes === 0
          ? <>No quedó ningún seguimiento sin tildar. Mañana arrancás con <b>{datos.manana}</b> en la cola.</>
          : <>Quedaron <b>{datos.pendientes}</b> seguimientos sin tildar — mañana arrancás con <b>{datos.manana}</b> en la cola.</>}
      </div>

      {cerrado && <Aviso tipo="ok" alCerrar={() => setCerrado(null)}>Día cerrado. Mañana tenés {cerrado.manana} en la cola.</Aviso>}

      <div className="fila-botones" style={{ marginTop: 14 }}>
        <button className="btn principal-btn chico" onClick={cerrarDia} disabled={datos.cerrado}>
          {datos.cerrado ? "Día cerrado" : "Cerrar el día"}
        </button>
        <span className="meta">Los de abajo los sumás vos; el resto se cuenta solo.</span>
      </div>
    </div>
  );
}
