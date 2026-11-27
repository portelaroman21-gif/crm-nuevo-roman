import React, { useEffect, useState } from "react";
import { api, copiar } from "../api.js";
import { Aviso, Vacio } from "../componentes/Comunes.jsx";

export default function Ajustes() {
  const [pestana, setPestana] = useState("ia");
  return (
    <div className="contenido">
      <div className="encabezado"><div><h1>Ajustes</h1></div></div>
      <div className="pestanas" style={{ marginTop: 14 }}>
        {[["ia", "Asistente"], ["mapa", "Mapa"], ["importar", "Importar de EstateOS"], ["cuenta", "Cuenta"]].map(([v, n]) => (
          <button key={v} className={`pestana ${pestana === v ? "activa" : ""}`} onClick={() => setPestana(v)}>{n}</button>
        ))}
      </div>
      {pestana === "ia" && <AjusteIA />}
      {pestana === "mapa" && <AjusteMapa />}
      {pestana === "importar" && <Importar />}
      {pestana === "cuenta" && <Cuenta />}
    </div>
  );
}

function AjusteIA() {
  const [cfg, setCfg] = useState({ baseUrl: "", modelo: "", apiKey: "" });
  const [estado, setEstado] = useState(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [probando, setProbando] = useState(false);

  useEffect(() => { api.get("/ia/config").then((d) => { setCfg({ ...d, apiKey: "" }); setEstado(d); }).catch((e) => setError(e.message)); }, []);

  async function guardarYProbar() {
    setProbando(true); setError(""); setOk("");
    try {
      const d = await api.post("/ia/probar", cfg);
      setOk(`Anda. El modelo contestó: ${d.texto}`);
      setEstado(await api.get("/ia/config"));
    } catch (e) { setError(e.message); }
    setProbando(false);
  }

  return (
    <>
      <p className="meta" style={{ maxWidth: 560 }}>
        El asistente usa cualquier proveedor con la API de OpenAI: OpenAI, Groq, DeepSeek, OpenRouter.
        Se le manda sólo el modelo y los mensajes, nada de temperatura ni parámetros sueltos.
      </p>
      <Aviso tipo="error" alCerrar={() => setError("")}>{error}</Aviso>
      <Aviso tipo="ok" alCerrar={() => setOk("")}>{ok}</Aviso>
      <div className="rejilla" style={{ maxWidth: 680, marginTop: 14 }}>
        <label className="campo"><span>Dirección de la API</span>
          <input type="text" value={cfg.baseUrl} onChange={(e) => setCfg({ ...cfg, baseUrl: e.target.value })} placeholder="https://api.openai.com/v1" /></label>
        <label className="campo"><span>Modelo</span>
          <input type="text" value={cfg.modelo} onChange={(e) => setCfg({ ...cfg, modelo: e.target.value })} placeholder="gpt-4o-mini" /></label>
        <label className="campo"><span>API key {estado?.configurada ? "(ya hay una guardada)" : ""}</span>
          <input type="password" value={cfg.apiKey} onChange={(e) => setCfg({ ...cfg, apiKey: e.target.value })} placeholder={estado?.configurada ? "dejala vacía para no cambiarla" : "sk-..."} /></label>
      </div>
      <div className="fila-botones" style={{ marginTop: 14 }}>
        <button className="btn principal-btn" onClick={guardarYProbar} disabled={probando}>
          {probando ? "probando…" : "Guardar y probar"}
        </button>
        <span className="meta">Guarda primero y después prueba, para no decirte que falta la key con el campo lleno.</span>
      </div>
    </>
  );
}

function AjusteMapa() {
  const [cfg, setCfg] = useState(null);
  const [eventos, setEventos] = useState([]);
  const [copiado, setCopiado] = useState("");

  async function cargar() {
    setCfg(await api.get("/conexion-mapa/config"));
    setEventos((await api.get("/conexion-mapa/eventos")).eventos);
  }
  useEffect(() => { cargar(); }, []);
  if (!cfg) return <div className="meta">Cargando…</div>;

  const destino = `${location.origin}/api/mapa/evento`;
  const ejemplo = `curl -X POST ${destino} \\
  -H "X-Clave: ${cfg.clave || "<generá una clave>"}" \\
  -H "Content-Type: application/json" \\
  -d '{"tipo":"registro","nombre":"Nombre","empresa":"Empresa","telefono":"1155667788","tipoLote":"800m2","zona":"San Miguel"}'`;

  return (
    <>
      <p className="meta" style={{ maxWidth: 620 }}>
        El mapa de zonificación manda un webhook acá cuando alguien se registra, guarda un lote o vuelve a entrar.
        Con el registro se crea la ficha del desarrollador; con los otros dos, sube al frente de la cola.
      </p>
      <div className="rejilla" style={{ maxWidth: 680, marginTop: 14 }}>
        <label className="campo"><span>Dirección del mapa</span>
          <input type="text" value={cfg.url || ""} onChange={(e) => setCfg({ ...cfg, url: e.target.value })}
            onBlur={() => api.post("/conexion-mapa/config", { url: cfg.url })} /></label>
        <label className="campo"><span>Clave compartida</span>
          <input type="text" value={cfg.clave || ""} readOnly placeholder="todavía no hay" /></label>
      </div>
      <div className="fila-botones" style={{ marginTop: 12 }}>
        <button className="btn" onClick={() => api.post("/conexion-mapa/config", { generar: true }).then(cargar)}>
          {cfg.clave ? "Generar otra clave" : "Generar clave"}
        </button>
        <button className="btn" onClick={async () => { await copiar(destino); setCopiado("dirección"); }}>Copiar la dirección del webhook</button>
        <button className="btn" onClick={async () => { await copiar(ejemplo); setCopiado("ejemplo"); }}>Copiar un ejemplo</button>
        {copiado && <span className="meta">copiado: {copiado}</span>}
      </div>

      <h2 style={{ marginTop: 24, marginBottom: 8 }}>Últimos movimientos</h2>
      <div className="lista">
        {eventos.length === 0 ? <Vacio>Todavía no llegó nada del mapa.</Vacio> : eventos.map((e) => (
          <div className="fila" key={e.id}>
            <span className="meta" style={{ width: 110 }}>{e.tipo.replace("_", " ")}</span>
            <span className="nombre-fila" style={{ width: 160 }}>{e.personaNombre || "—"}</span>
            <span className="crece recorta meta-medio">{e.detalle || ""}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function Importar() {
  const [texto, setTexto] = useState("");
  const [mes, setMes] = useState("2026-11");
  const [revision, setRevision] = useState(null);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState(null);

  function filas() {
    const d = JSON.parse(texto);
    const arreglo = Array.isArray(d) ? d : Array.isArray(d.filas) ? d.filas : Array.isArray(d.personas) ? d.personas : null;
    if (!arreglo) throw new Error("El archivo tiene que ser una lista de fichas");
    return arreglo;
  }

  async function revisar() {
    setError(""); setResultado(null);
    try { setRevision(await api.post("/importar/revisar", { filas: filas(), soloMes: mes || null })); }
    catch (e) { setError(e.message); }
  }
  async function confirmar() {
    try { setResultado(await api.post("/importar/confirmar", { filas: filas(), soloMes: mes || null })); setRevision(null); }
    catch (e) { setError(e.message); }
  }

  return (
    <>
      <p className="meta" style={{ maxWidth: 620 }}>
        Pegá acá el JSON exportado de EstateOS, o soltá el archivo. Antes de importar se revisa una vez:
        qué entra, qué está repetido y qué está incompleto. Nada se carga hasta que confirmes.
      </p>
      <Aviso tipo="error" alCerrar={() => setError("")}>{error}</Aviso>
      {resultado && <Aviso tipo="ok" alCerrar={() => setResultado(null)}>Entraron {resultado.creados} fichas.{resultado.fallaron.length ? ` ${resultado.fallaron.length} fallaron.` : ""}</Aviso>}

      <div className="rejilla dos" style={{ maxWidth: 680, marginTop: 14 }}>
        <label className="campo"><span>Sólo el mes</span>
          <input type="text" value={mes} onChange={(e) => setMes(e.target.value)} placeholder="2026-11 · vacío para traer todo" /></label>
        <label className="campo"><span>Archivo</span>
          <input type="file" accept=".json,application/json" onChange={(e) => {
            const f = e.target.files[0]; if (!f) return;
            const lector = new FileReader();
            lector.onload = () => setTexto(String(lector.result));
            lector.readAsText(f);
          }} /></label>
      </div>
      <div style={{ marginTop: 12, maxWidth: 680 }}>
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder='[{"nombre":"...","telefono":"...","fecha":"2026-11-04"}]' style={{ minHeight: 140, fontFamily: "ui-monospace, monospace", fontSize: 12 }} />
      </div>
      <div className="fila-botones" style={{ marginTop: 12 }}>
        <button className="btn" onClick={revisar} disabled={!texto.trim()}>Revisar</button>
        {revision && <button className="btn principal-btn" onClick={confirmar}>Importar {revision.totales.entran} fichas</button>}
      </div>

      {revision && (
        <>
          <div className="numeros" style={{ marginTop: 18 }}>
            <div className="numero destacado"><div className="valor">{revision.totales.entran}</div><div className="titulo">Entran</div><div className="detalle" /></div>
            <div className="numero"><div className="valor">{revision.totales.duplicados}</div><div className="titulo">Repetidos</div><div className="detalle">ya están o están dos veces</div></div>
            <div className="numero"><div className="valor">{revision.totales.incompletos}</div><div className="titulo">Incompletos</div><div className="detalle">sin nombre o sin teléfono</div></div>
            <div className="numero"><div className="valor">{revision.totales.fueraDeFecha}</div><div className="titulo">Fuera del mes</div><div className="detalle">{mes || "sin filtro"}</div></div>
          </div>
          <h2 style={{ marginTop: 20, marginBottom: 8 }}>Qué entra</h2>
          <div className="lista">
            {revision.entran.slice(0, 60).map((p, i) => (
              <div className="fila" key={i}>
                <span className="nombre-fila" style={{ width: 200 }}>{p.nombre}</span>
                <span className="meta" style={{ width: 130 }}>{p.lista}</span>
                <span className="meta" style={{ width: 130 }}>{p.telefono}</span>
                <span className="crece recorta meta-medio">{p.queQuiere || p.direccion || p.empresa || ""}</span>
              </div>
            ))}
          </div>
          {revision.duplicados.length > 0 && (
            <>
              <h2 style={{ marginTop: 20, marginBottom: 8 }}>Repetidos, no entran</h2>
              <div className="lista">
                {revision.duplicados.map((p, i) => (
                  <div className="fila" key={i}>
                    <span className="nombre-fila" style={{ width: 200 }}>{p.nombre}</span>
                    <span className="crece meta-medio">{p.motivo}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}

function Cuenta() {
  const [datos, setDatos] = useState({ actual: "", nueva: "" });
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  async function cambiar() {
    setError(""); setOk("");
    try { await api.post("/sesion/clave", datos); setOk("Clave cambiada."); setDatos({ actual: "", nueva: "" }); }
    catch (e) { setError(e.message); }
  }

  return (
    <>
      <Aviso tipo="error" alCerrar={() => setError("")}>{error}</Aviso>
      <Aviso tipo="ok" alCerrar={() => setOk("")}>{ok}</Aviso>
      <div className="rejilla dos" style={{ maxWidth: 520, marginTop: 14 }}>
        <label className="campo"><span>Clave actual</span>
          <input type="password" value={datos.actual} onChange={(e) => setDatos({ ...datos, actual: e.target.value })} /></label>
        <label className="campo"><span>Clave nueva</span>
          <input type="password" value={datos.nueva} onChange={(e) => setDatos({ ...datos, nueva: e.target.value })} /></label>
      </div>
      <div className="fila-botones" style={{ marginTop: 14 }}>
        <button className="btn principal-btn" onClick={cambiar}>Cambiar la clave</button>
      </div>
      <p className="meta" style={{ marginTop: 20, maxWidth: 560 }}>
        La base es un archivo SQLite en el volumen de EasyPanel. Se respalda sola todos los días y se guardan los últimos 14.
      </p>
    </>
  );
}
