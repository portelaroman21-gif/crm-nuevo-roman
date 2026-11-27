import React, { useEffect, useState } from "react";
import { api, enPalabras, hoyLocal, sumarDias, NOMBRE_LISTA, linkWhatsapp, copiar } from "../api.js";
import { Aviso, Chip, Tilde, Vacio } from "../componentes/Comunes.jsx";
import BloqueProspeccion from "../componentes/BloqueProspeccion.jsx";

const ETIQUETA_TIPO = {
  seguimientos: "Seguimientos",
  prospeccion: "Prospección",
  captacion: "Captación",
  visitas: "Visitas",
  contenido: "Contenido",
  suelto: "Suelto",
};

export default function Hoy({ abrirFicha, irA }) {
  const [fecha, setFecha] = useState(hoyLocal());
  const [dia, setDia] = useState(null);
  const [error, setError] = useState("");
  const [consejo, setConsejo] = useState("");
  const [pensando, setPensando] = useState(false);
  const [nuevoSuelto, setNuevoSuelto] = useState("");

  async function cargar() {
    try { setDia(await api.get(`/dia?fecha=${fecha}`)); setError(""); }
    catch (e) { setError(e.message); }
  }
  useEffect(() => { cargar(); }, [fecha]);

  async function tildar(bloqueId, personaId, canal) {
    try { await api.post("/dia/tildar", { bloqueId, personaId, canal }); cargar(); }
    catch (e) { setError(e.message); }
  }
  async function destildar(bloqueId, personaId) {
    try { await api.post("/dia/destildar", { bloqueId, personaId }); cargar(); }
    catch (e) { setError(e.message); }
  }

  async function preguntarIA() {
    setPensando(true); setConsejo("");
    try { setConsejo((await api.post("/ia/empezar", { fecha })).texto); }
    catch (e) { setConsejo(`No pude: ${e.message}`); }
    setPensando(false);
  }

  async function agregarSuelto(bloqueId) {
    if (!nuevoSuelto.trim()) return;
    await api.post("/dia/sueltos", { fecha, texto: nuevoSuelto, bloqueId });
    setNuevoSuelto(""); cargar();
  }

  if (!dia) return <div className="contenido"><Aviso tipo="error">{error}</Aviso><div className="meta">Cargando el día…</div></div>;

  const esHoy = fecha === dia.hoy;

  return (
    <div className="contenido">
      <div className="encabezado">
        <div>
          <h1>{esHoy ? "Hoy" : enPalabras(fecha)}</h1>
          <div className="sub">
            {esHoy ? `${enPalabras(fecha)} · son las ${dia.hora}` : "otro día"}
            {" · "}{dia.hechos} seguimientos hechos, {dia.pendientes} en la cola
          </div>
        </div>
        <div className="fila-botones">
          <button className="btn plano chico" onClick={() => setFecha(sumarDias(fecha, -1))}>anterior</button>
          {!esHoy && <button className="btn plano chico" onClick={() => setFecha(dia.hoy)}>hoy</button>}
          <button className="btn plano chico" onClick={() => setFecha(sumarDias(fecha, 1))}>siguiente</button>
          <button className="btn chico" onClick={preguntarIA} disabled={pensando}>
            {pensando ? "pensando…" : "Por dónde empiezo"}
          </button>
        </div>
      </div>

      <Aviso tipo="error" alCerrar={() => setError("")}>{error}</Aviso>

      {consejo && (
        <div className="resumen-linea" style={{ margin: "14px 0" }}>
          <div className="texto-ia">{consejo}</div>
          <button className="btn plano chico" style={{ marginTop: 8 }} onClick={() => setConsejo("")}>cerrar</button>
        </div>
      )}

      {dia.afuera.length > 0 && (
        <Aviso>Por la agenda quedó fuera del día: {dia.afuera.map((b) => b.nombre).join(", ")}.</Aviso>
      )}

      <div style={{ marginTop: 16 }}>
        {dia.bloques.length === 0 && (
          <Vacio acciones={<button className="btn principal-btn chico" onClick={() => irA("plantilla")}>Armar la plantilla</button>}>
            No hay bloques para este día. La plantilla de la semana todavía no tiene nada cargado para {enPalabras(fecha).split(" ")[0]}.
          </Vacio>
        )}

        {dia.bloques.map((b) => (
          <div className={`bloque ${b.fijo ? "fijo" : ""}`} key={b.id}>
            <div className="bloque-cabeza">
              <span className="bloque-hora">{b.hora}</span>
              <span className="bloque-nombre crece">{b.nombre}</span>
              <span className="meta">{ETIQUETA_TIPO[b.tipo]} · {b.minutos} min</span>
              {b.fueraDelBloque > 0 && <Chip>{b.fueraDelBloque} para después</Chip>}
            </div>

            <div className="bloque-cuerpo">
              {(b.tipo === "seguimientos" || b.tipo === "captacion") && (
                b.items.length === 0 ? (
                  <Vacio acciones={
                    <button className="btn chico" onClick={() => irA(b.tipo === "captacion" ? "captacion" : "lead")}>
                      {b.tipo === "captacion" ? "Ir a captación" : "Ir a leads"}
                    </button>
                  }>
                    {b.tipo === "captacion"
                      ? "No hay propietarios para contactar hoy."
                      : "No hay a quién seguir en este bloque."}
                  </Vacio>
                ) : (
                  b.items.map((p) => (
                    <div className={`fila ${p.hecho ? "hecha" : ""}`} key={p.id}>
                      <Tilde
                        marcado={p.hecho}
                        alTildar={() => (p.hecho ? destildar(b.id, p.id) : tildar(b.id, p.id, "otro"))}
                      />
                      <span className="nombre-fila recorta clickeable" style={{ width: 170 }} onClick={() => abrirFicha(p.id)}>
                        {p.nombre}
                      </span>
                      <span className="crece recorta meta-medio">
                        {p.proximoPaso || p.queQuiere || p.direccion || p.empresa || "—"}
                      </span>
                      {p.importante ? <Chip tipo="acento">importante</Chip> : null}
                      {p.atraso > 0 ? <Chip tipo={p.atraso > 5 ? "alerta" : ""}>{p.atraso}d</Chip> : null}
                      <span className="meta" style={{ width: 88 }}>{NOMBRE_LISTA[p.lista]}</span>
                      {!p.hecho && p.telefono && (
                        <div className="fila-botones">
                          <button className="btn chico" onClick={() => {
                            const l = linkWhatsapp(p.telefono);
                            if (l) window.open(l, "_blank", "noopener");
                            tildar(b.id, p.id, "whatsapp");
                          }}>WhatsApp</button>
                          <button className="btn chico" onClick={async () => {
                            await copiar(p.telefono);
                            tildar(b.id, p.id, "copia");
                          }}>Copiar</button>
                        </div>
                      )}
                    </div>
                  ))
                )
              )}

              {b.tipo === "prospeccion" && (
                <BloqueProspeccion bloque={b} alCambiar={cargar} abrirFicha={abrirFicha} irA={irA} />
              )}

              {b.tipo === "visitas" && (
                b.items.length === 0 ? <Vacio>Sin visitas agendadas.</Vacio> : b.items.map((c) => (
                  <div className={`fila ${c.hecho ? "hecha" : ""}`} key={c.id}>
                    <Tilde marcado={!!c.hecho} alTildar={async () => { await api.patch(`/agenda/${c.id}`, { hecho: !c.hecho }); cargar(); }} />
                    {c.personaNombre ? (
                      <span className="nombre-fila recorta clickeable" style={{ width: 170 }} onClick={() => abrirFicha(c.personaId)}>
                        {c.personaNombre}
                      </span>
                    ) : (
                      <span className="nombre-fila recorta" style={{ width: 170 }}>{c.titulo}</span>
                    )}
                    <span className="crece recorta meta-medio">{c.lugar || (c.personaNombre ? c.titulo : "sin dirección cargada")}</span>
                    <span className="meta" style={{ width: 92 }}>{c.hora} · {c.minutos} min</span>
                    {c.personaTelefono && !c.hecho && (
                      <div className="fila-botones">
                        <button className="btn chico" onClick={() => {
                          const l = linkWhatsapp(c.personaTelefono);
                          if (l) window.open(l, "_blank", "noopener");
                        }}>WhatsApp</button>
                        <button className="btn chico" onClick={() => copiar(c.personaTelefono)}>Copiar</button>
                      </div>
                    )}
                  </div>
                ))
              )}

              {b.tipo === "contenido" && (
                b.items.length === 0 ? (
                  <Vacio acciones={<button className="btn chico" onClick={() => irA("contenido")}>Cargar una idea</button>}>
                    No hay piezas de contenido pendientes.
                  </Vacio>
                ) : b.items.map((c) => (
                  <div className={`fila ${c.hecho ? "hecha" : ""}`} key={c.id}>
                    <Tilde marcado={c.hecho} alTildar={() => api.post("/dia/tildar", { bloqueId: b.id, contenidoId: c.id }).then(cargar)} />
                    <span className="nombre-fila crece recorta clickeable" onClick={() => irA("contenido")}>{c.titulo}</span>
                    <Chip>{c.etapa}</Chip>
                    {c.fechaObjetivo && <span className="meta">para {c.fechaObjetivo}</span>}
                  </div>
                ))
              )}

              {b.tipo === "suelto" && (
                <>
                  {b.items.map((t) => (
                    <div className={`fila ${t.hecho ? "hecha" : ""}`} key={t.id}>
                      <Tilde marcado={t.hecho} alTildar={() => api.patch(`/dia/sueltos/${t.id}`, { hecho: !t.hecho }).then(cargar)} />
                      <span className="nombre-fila crece recorta">{t.texto}</span>
                      <button className="btn plano chico" onClick={() => api.borrar(`/dia/sueltos/${t.id}`).then(cargar)}>sacar</button>
                    </div>
                  ))}
                  <div className="fila">
                    <input
                      type="text" placeholder="agregar algo suelto" value={nuevoSuelto}
                      onChange={(e) => setNuevoSuelto(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && agregarSuelto(b.id)}
                      style={{ border: 0, background: "none", height: 30, paddingLeft: 26 }}
                    />
                    <button className="btn chico" onClick={() => agregarSuelto(b.id)}>agregar</button>
                  </div>
                </>
              )}
            </div>

            {(b.tipo === "seguimientos" || b.tipo === "captacion") && b.fueraDelBloque > 0 && (
              <div className="bloque-pie">
                Entran {b.cupo} en {b.minutos} minutos. Los otros {b.fueraDelBloque} quedan para el próximo bloque, no se pierden.
              </div>
            )}
          </div>
        ))}
      </div>

      {dia.bloques.length > 0 && (
        <div className="fila-botones" style={{ marginTop: 18 }}>
          <button className="btn chico" onClick={() => irA("numeros")}>Cerrar el día</button>
          <button className="btn plano chico" onClick={() => irA("plantilla")}>Editar los bloques</button>
          <button className="btn plano chico" onClick={() => api.post("/dia/rearmar", { fecha }).then(cargar)}>
            Volver a armar desde la plantilla
          </button>
        </div>
      )}
    </div>
  );
}
