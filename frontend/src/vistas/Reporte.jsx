import React, { useEffect, useState } from "react";
import { api, hoyLocal } from "../api.js";
import { Aviso } from "../componentes/Comunes.jsx";

function Diferencia({ ahora, antes }) {
  if (antes === null || antes === undefined) return null;
  const d = ahora - antes;
  if (d === 0) return <span className="meta"> igual</span>;
  return <span className={d > 0 ? "sube" : "baja"}> {d > 0 ? "+" : ""}{Math.round(d * 10) / 10}</span>;
}

export default function Reporte() {
  const [periodo, setPeriodo] = useState("semana");
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get(`/numeros/reporte?periodo=${periodo}&fecha=${hoyLocal()}`).then(setDatos).catch((e) => setError(e.message));
  }, [periodo]);

  if (!datos) return <div className="contenido"><Aviso tipo="error">{error}</Aviso><div className="meta">Cargando…</div></div>;

  return (
    <div className="contenido">
      <div className="encabezado">
        <div>
          <h1>Reporte</h1>
          <div className="sub">{datos.titulo} · comparado con {datos.desdeAntes} a {datos.hastaAntes}</div>
        </div>
        <div className="pestanas" style={{ border: 0, marginBottom: 0 }}>
          <button className={`pestana ${periodo === "semana" ? "activa" : ""}`} onClick={() => setPeriodo("semana")}>Semana</button>
          <button className={`pestana ${periodo === "mes" ? "activa" : ""}`} onClick={() => setPeriodo("mes")}>Mes</button>
        </div>
      </div>

      <h2 style={{ marginTop: 20, marginBottom: 8 }}>Dónde se rompe el embudo</h2>
      <div className="lista">
        {datos.embudo.map((e) => (
          <div className="fila" style={{ minHeight: 56, alignItems: "flex-start", paddingTop: 10 }} key={e.nombre}>
            <div className="crece">
              <div>{e.nombre}</div>
              <div className="meta">{e.lectura}</div>
            </div>
            <div style={{ textAlign: "right", minWidth: 110 }}>
              <div style={{ fontSize: 24, fontWeight: 600, color: e.valor === null ? "var(--texto-tenue)" : "var(--acento)" }}>
                {e.valor === null ? "—" : e.valor}
              </div>
              <div className="meta">
                {e.arriba} de {e.abajo}
                <Diferencia ahora={e.valor ?? 0} antes={e.antes} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <h2 style={{ marginTop: 24, marginBottom: 8 }}>Totales</h2>
      <div className="lista">
        <table className="datos">
          <thead>
            <tr><th>Número</th><th className="num">{datos.periodo === "semana" ? "Esta semana" : "Este mes"}</th><th className="num">Antes</th></tr>
          </thead>
          <tbody>
            {datos.totales.map((t) => (
              <tr key={t.nombre}>
                <td>{t.nombre}</td>
                <td className="num" style={{ fontWeight: 600 }}>{t.ahora}<Diferencia ahora={t.ahora} antes={t.antes} /></td>
                <td className="num meta">{t.antes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="sub" style={{ marginTop: 12 }}>No hay un tercer reporte: el mensual es esta misma pantalla con el otro selector.</div>
    </div>
  );
}
