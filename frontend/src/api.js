const CLAVE_TOKEN = "crm_rp_token";

export function token() {
  try { return localStorage.getItem(CLAVE_TOKEN) || ""; } catch { return ""; }
}
export function guardarToken(t) {
  try { if (t) localStorage.setItem(CLAVE_TOKEN, t); else localStorage.removeItem(CLAVE_TOKEN); } catch { /* sin storage igual funciona */ }
}

async function pedir(ruta, opciones = {}) {
  const cabeceras = { ...(opciones.headers || {}) };
  if (opciones.body !== undefined) cabeceras["Content-Type"] = "application/json";
  const t = token();
  if (t) cabeceras.Authorization = `Bearer ${t}`;

  const r = await fetch(`/api${ruta}`, {
    ...opciones,
    headers: cabeceras,
    body: opciones.body === undefined ? undefined : JSON.stringify(opciones.body),
  });

  let datos = null;
  try { datos = await r.json(); } catch { datos = null; }

  if (r.status === 401 && t) { guardarToken(""); location.reload(); }
  if (!r.ok) {
    const e = new Error((datos && datos.error) || `Error ${r.status}`);
    e.datos = datos;
    e.estado = r.status;
    throw e;
  }
  return datos;
}

export const api = {
  get: (ruta) => pedir(ruta),
  post: (ruta, body) => pedir(ruta, { method: "POST", body: body || {} }),
  patch: (ruta, body) => pedir(ruta, { method: "PATCH", body: body || {} }),
  borrar: (ruta) => pedir(ruta, { method: "DELETE" }),
};

// El catálogo de orígenes no cambia dentro de una sesión: lo pedimos una vez.
let catalogoOrigenes = null;
export async function cargarOrigenes() {
  if (!catalogoOrigenes) catalogoOrigenes = await api.get("/personas/origenes");
  return catalogoOrigenes;
}

export function hoyLocal() {
  const ahora = new Date(Date.now() - 180 * 60000);
  return ahora.toISOString().slice(0, 10);
}

export function sumarDias(fecha, dias) {
  return new Date(Date.parse(`${fecha}T12:00:00Z`) + dias * 86400000).toISOString().slice(0, 10);
}

const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const DIAS = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];

export function enPalabras(fecha) {
  if (!fecha) return "";
  const d = new Date(Date.parse(`${fecha}T12:00:00Z`));
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`;
}

export function corta(fecha) {
  if (!fecha) return "";
  const d = new Date(Date.parse(`${fecha}T12:00:00Z`));
  return `${d.getUTCDate()} ${MESES[d.getUTCMonth()].slice(0, 3)}`;
}

export const NOMBRE_LISTA = {
  lead: "Leads",
  calificado: "Calificados",
  captacion: "Captación",
  desarrollador: "Desarrolladores",
};

export const SINGULAR_LISTA = {
  lead: "Lead",
  calificado: "Calificado",
  captacion: "Captación",
  desarrollador: "Desarrollador",
};

export function linkWhatsapp(telefono, texto = "") {
  const digitos = String(telefono || "").replace(/\D/g, "");
  if (!digitos) return null;
  const con54 = digitos.startsWith("54") ? digitos : `54${digitos.length === 10 ? "9" : ""}${digitos}`;
  return `https://wa.me/${con54}${texto ? `?text=${encodeURIComponent(texto)}` : ""}`;
}

export async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    const a = document.createElement("textarea");
    a.value = texto;
    a.style.position = "fixed";
    a.style.opacity = "0";
    document.body.appendChild(a);
    a.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { ok = false; }
    document.body.removeChild(a);
    return ok;
  }
}
