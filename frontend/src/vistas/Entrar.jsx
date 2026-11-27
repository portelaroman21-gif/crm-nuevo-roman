import React, { useEffect, useState } from "react";
import { api, guardarToken } from "../api.js";
import { Aviso } from "../componentes/Comunes.jsx";

export default function Entrar({ alEntrar }) {
  const [instalado, setInstalado] = useState(null);
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [yendo, setYendo] = useState(false);

  useEffect(() => { api.get("/sesion/estado").then((d) => setInstalado(d.instalado)).catch(() => setInstalado(true)); }, []);

  async function enviar(e) {
    e.preventDefault();
    setError(""); setYendo(true);
    try {
      const d = await api.post(instalado ? "/sesion/entrar" : "/sesion/instalar", { email, clave });
      guardarToken(d.token);
      alEntrar();
    } catch (err) { setError(err.message); }
    setYendo(false);
  }

  if (instalado === null) return null;

  return (
    <div className="entrar">
      <form className="caja" onSubmit={enviar}>
        <div style={{ marginBottom: 18 }}>
          <h1>CRM Román Portela</h1>
          <div className="sub">{instalado ? "Entrá para seguir" : "Creá tu usuario, es la única vez"}</div>
        </div>
        <Aviso tipo="error" alCerrar={() => setError("")}>{error}</Aviso>
        <div style={{ display: "grid", gap: 10 }}>
          <label className="campo"><span>Mail</span>
            <input type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label className="campo"><span>Clave</span>
            <input type="password" value={clave} onChange={(e) => setClave(e.target.value)} required minLength={6} /></label>
          <button className="btn principal-btn" style={{ height: 32 }} disabled={yendo}>
            {yendo ? "un momento…" : instalado ? "Entrar" : "Crear usuario"}
          </button>
        </div>
      </form>
    </div>
  );
}
