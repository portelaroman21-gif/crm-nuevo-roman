"use strict";

// De dónde salió un lead. Lo importante no es la etiqueta: es si lo buscaste
// vos (frío) o si te llegó. Esa diferencia es la que hace que el embudo del
// reporte signifique algo — un referido de Agus no es prospección en frío.
const ORIGENES = [
  // Lo buscaste vos.
  { clave: "cartel_calle", nombre: "Cartel en la calle", grupo: "En frío", frio: true },
  { clave: "dueno_directo", nombre: "Dueño directo publicado", grupo: "En frío", frio: true },
  { clave: "puerta_a_puerta", nombre: "Puerta a puerta", grupo: "En frío", frio: true },
  { clave: "base_propietarios", nombre: "Base de propietarios", grupo: "En frío", frio: true },
  { clave: "visita_obra", nombre: "Visita a obra", grupo: "En frío", frio: true },
  { clave: "frio_otro", nombre: "Otra prospección en frío", grupo: "En frío", frio: true },

  // Te llegó porque pagaste o publicaste.
  { clave: "instagram", nombre: "Instagram", grupo: "Publicidad", frio: false },
  { clave: "facebook", nombre: "Facebook", grupo: "Publicidad", frio: false },
  { clave: "portal", nombre: "Portal (Zonaprop, Argenprop)", grupo: "Publicidad", frio: false },
  { clave: "google", nombre: "Google", grupo: "Publicidad", frio: false },

  // Te llegó porque alguien te lo pasó.
  { clave: "referido_agus", nombre: "Referido de Agus", grupo: "Referidos", frio: false },
  { clave: "referido_cliente", nombre: "Referido de un cliente", grupo: "Referidos", frio: false },
  { clave: "referido_colega", nombre: "Referido de un colega", grupo: "Referidos", frio: false },

  // Te llegó solo.
  { clave: "cartel_propio", nombre: "Cartel propio", grupo: "Entrantes", frio: false },
  { clave: "mapa", nombre: "Mapa de zonificación", grupo: "Entrantes", frio: false },
  { clave: "whatsapp_directo", nombre: "Me escribió directo", grupo: "Entrantes", frio: false },
  { clave: "web", nombre: "Web / romanportela.com", grupo: "Entrantes", frio: false },

  // Para lo que no entra en ninguna: se escribe al lado.
  { clave: "otro", nombre: "Otro", grupo: "Otros", frio: false },
];

const POR_CLAVE = new Map(ORIGENES.map((o) => [o.clave, o]));
const GRUPOS = [...new Set(ORIGENES.map((o) => o.grupo))];

function existe(clave) {
  return POR_CLAVE.has(String(clave || ""));
}

function esFrio(clave) {
  const o = POR_CLAVE.get(String(clave || ""));
  return o ? !!o.frio : false;
}

function nombreDe(clave) {
  const o = POR_CLAVE.get(String(clave || ""));
  return o ? o.nombre : String(clave || "");
}

// Las fichas viejas (y las importadas de EstateOS) traen texto libre.
// Lo acomodamos al origen que más se le parece, sin perder lo que decía.
function adivinar(texto) {
  const t = String(texto || "").toLowerCase().trim();
  if (!t) return null;
  if (existe(t)) return t;
  if (/instagram|\big\b/.test(t)) return "instagram";
  if (/facebook|\bfb\b/.test(t)) return "facebook";
  if (/zonaprop|argenprop|mercadolibre|portal|inmoup/.test(t)) return "portal";
  if (/google|adwords/.test(t)) return "google";
  if (/agus/.test(t)) return "referido_agus";
  // El cartel se mira antes que el colega: "cartel de otra inmobiliaria"
  // es un cartel que viste en la calle, no alguien que te pasó un dato.
  if (/cartel propio|mi cartel/.test(t)) return "cartel_propio";
  if (/cartel/.test(t)) return "cartel_calle";
  if (/colega/.test(t) || /referid.*inmobiliari/.test(t)) return "referido_colega";
  if (/referid|recomend|me lo pas/.test(t)) return "referido_cliente";
  if (/mapa|zonific/.test(t)) return "mapa";
  if (/due[nñ]o|particular/.test(t)) return "dueno_directo";
  if (/puerta|timbre/.test(t)) return "puerta_a_puerta";
  if (/obra/.test(t)) return "visita_obra";
  if (/base|listado|padr[oó]n/.test(t)) return "base_propietarios";
  if (/web|romanportela|sitio/.test(t)) return "web";
  if (/whatsapp|escribi/.test(t)) return "whatsapp_directo";
  if (/fr[ií]o/.test(t)) return "frio_otro";
  return "otro";
}

module.exports = { ORIGENES, GRUPOS, existe, esFrio, nombreDe, adivinar, POR_CLAVE };
