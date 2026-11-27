import React, { useCallback, useEffect, useState } from "react";
import { api, guardarToken, token, NOMBRE_LISTA } from "./api.js";
import Entrar from "./vistas/Entrar.jsx";
import Hoy from "./vistas/Hoy.jsx";
import Listas from "./vistas/Listas.jsx";
import Agenda from "./vistas/Agenda.jsx";
import Contenido from "./vistas/Contenido.jsx";
import EndOfDay from "./vistas/EndOfDay.jsx";
import Reporte from "./vistas/Reporte.jsx";
import Plantilla from "./vistas/Plantilla.jsx";
import Asistente from "./vistas/Asistente.jsx";
import Ajustes from "./vistas/Ajustes.jsx";
import Ficha from "./componentes/Ficha.jsx";

const LISTAS = ["lead", "calificado", "captacion", "desarrollador"];

export default function App() {
  const [entrado, setEntrado] = useState(!!token());
  const [vista, setVista] = useState("hoy");
  const [fichaId, setFichaId] = useState(null);
  const [resumen, setResumen] = useState({});
  const [clave, setClave] = useState(0);

  const refrescar = useCallback(() => {
    setClave((c) => c + 1);
    api.get("/personas/resumen").then((d) => setResumen(d.porLista)).catch(() => {});
  }, []);

  useEffect(() => { if (entrado) refrescar(); }, [entrado, refrescar]);

  if (!entrado) return <Entrar alEntrar={() => setEntrado(true)} />;

  const abrirFicha = (id) => setFichaId(id);
  const irA = (v) => { setFichaId(null); setVista(v); };

  const item = (v, nombre, cuenta) => (
    <button key={v} className={`nav ${vista === v ? "activo" : ""}`} onClick={() => irA(v)}>
      <span>{nombre}</span>
      {cuenta ? <span className="cuenta">{cuenta}</span> : null}
    </button>
  );

  return (
    <div className="app">
      <nav className="lateral">
        <div className="marca"><b>CRM</b>Román Portela</div>
        {item("hoy", "Hoy")}
        {item("agenda", "Agenda")}
        {item("numeros", "End of Day")}
        {item("reporte", "Reporte")}
        <div className="separador-nav" />
        {LISTAS.map((l) => item(l, NOMBRE_LISTA[l], resumen[l] ? resumen[l].paraHoy || "" : ""))}
        <div className="separador-nav" />
        {item("contenido", "Contenido")}
        {item("asistente", "Asistente")}
        {item("plantilla", "Plantilla")}
        {item("ajustes", "Ajustes")}
        <div style={{ flex: 1 }} />
        <button className="nav" onClick={() => { guardarToken(""); setEntrado(false); }}>
          <span className="meta">Salir</span>
        </button>
      </nav>

      <main className="principal">
        {vista === "hoy" && <Hoy abrirFicha={abrirFicha} irA={irA} key={clave} />}
        {vista === "agenda" && <Agenda abrirFicha={abrirFicha} />}
        {vista === "numeros" && <EndOfDay />}
        {vista === "reporte" && <Reporte />}
        {LISTAS.includes(vista) && <Listas lista={vista} abrirFicha={abrirFicha} recargarClave={clave} />}
        {vista === "contenido" && <Contenido />}
        {vista === "asistente" && <Asistente />}
        {vista === "plantilla" && <Plantilla />}
        {vista === "ajustes" && <Ajustes />}
      </main>

      {fichaId && <Ficha personaId={fichaId} alCerrar={() => setFichaId(null)} alCambiar={refrescar} />}
    </div>
  );
}
