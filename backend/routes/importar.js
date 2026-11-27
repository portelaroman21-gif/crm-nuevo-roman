"use strict";
const { enrutador } = require("../lib/ruta.js");
const { db } = require("../db.js");
const F = require("../lib/fechas.js");
const P = require("../lib/personas.js");

const r = enrutador();

const ALIAS = {
  nombre: ["nombre", "name", "nombreCompleto", "contacto", "cliente", "titulo"],
  telefono: ["telefono", "tel", "celular", "phone", "whatsapp", "numero"],
  origen: ["origen", "fuente", "source", "canal"],
  queQuiere: ["queQuiere", "interes", "busca", "observaciones", "detalle", "descripcion", "nota", "notas"],
  zona: ["zona", "barrio", "localidad", "area"],
  operacion: ["operacion", "tipoOperacion", "op"],
  rango: ["rango", "presupuesto", "precio", "monto"],
  plazo: ["plazo", "cuando", "urgencia"],
  direccion: ["direccion", "domicilio", "calle"],
  tipoPropiedad: ["tipoPropiedad", "tipo", "tipologia"],
  precioPretendido: ["precioPretendido", "precio", "valorPretendido"],
  empresa: ["empresa", "desarrolladora", "compania", "razonSocial"],
  rol: ["rol", "cargo", "puesto"],
  tipoLote: ["tipoLote", "lote", "busquedaLote"],
  superficie: ["superficie", "m2", "metros"],
  fecha: ["fecha", "creado", "createdAt", "alta", "fechaAlta", "created_at"],
  lista: ["lista", "tabla", "tipoFicha", "categoria", "estado"],
};

function tomar(fila, campo) {
  const claves = Object.keys(fila);
  for (const alias of ALIAS[campo] || [campo]) {
    const encontrada = claves.find((k) => k.toLowerCase().replace(/[_\s-]/g, "") === alias.toLowerCase());
    if (encontrada && fila[encontrada] != null && String(fila[encontrada]).trim() !== "")
      return String(fila[encontrada]).trim();
  }
  return null;
}

function adivinarLista(fila) {
  const crudo = (tomar(fila, "lista") || "").toLowerCase();
  if (/desarroll|lote/.test(crudo)) return "desarrollador";
  if (/propietar|captac|duen|dueñ/.test(crudo)) return "captacion";
  if (/calific|oportunid|client/.test(crudo)) return "calificado";
  if (tomar(fila, "empresa") || tomar(fila, "tipoLote")) return "desarrollador";
  if (tomar(fila, "direccion") && tomar(fila, "precioPretendido")) return "captacion";
  return "lead";
}

function normalizar(fila) {
  const lista = adivinarLista(fila);
  const persona = {
    lista,
    nombre: tomar(fila, "nombre"),
    telefono: tomar(fila, "telefono"),
    origen: tomar(fila, "origen") || "EstateOS",
    queQuiere: tomar(fila, "queQuiere"),
    zona: tomar(fila, "zona"),
  };
  if (lista === "calificado") {
    persona.operacion = tomar(fila, "operacion");
    persona.rango = tomar(fila, "rango");
    persona.plazo = tomar(fila, "plazo");
  }
  if (lista === "captacion") {
    persona.direccion = tomar(fila, "direccion");
    persona.tipoPropiedad = tomar(fila, "tipoPropiedad");
    persona.precioPretendido = tomar(fila, "precioPretendido");
  }
  if (lista === "desarrollador") {
    persona.empresa = tomar(fila, "empresa");
    persona.rol = tomar(fila, "rol");
    persona.tipoLote = tomar(fila, "tipoLote");
    persona.superficie = tomar(fila, "superficie");
  }
  const fecha = tomar(fila, "fecha");
  persona._fecha = fecha ? String(fecha).slice(0, 10) : null;
  return persona;
}

async function revisar(filas, { soloMes = null } = {}) {
  const vistos = new Map();
  const entran = [];
  const duplicados = [];
  const incompletos = [];
  const fueraDeFecha = [];

  for (const fila of Array.isArray(filas) ? filas : []) {
    const p = normalizar(fila);
    if (soloMes && p._fecha && !p._fecha.startsWith(soloMes)) { fueraDeFecha.push(p); continue; }
    if (soloMes && !p._fecha) { fueraDeFecha.push(p); continue; }
    if (!p.nombre) { incompletos.push({ ...p, motivo: "sin nombre" }); continue; }
    const clave = P.clavePorTelefono(p.telefono);
    if (!clave) { incompletos.push({ ...p, motivo: "sin teléfono" }); continue; }
    if (vistos.has(clave)) { duplicados.push({ ...p, motivo: "repetido en el archivo" }); continue; }
    const yaEnSistema = await P.porTelefono(p.telefono);
    if (yaEnSistema) { duplicados.push({ ...p, motivo: `ya está como ${yaEnSistema.nombre}` }); continue; }
    vistos.set(clave, true);
    entran.push(p);
  }
  return { entran, duplicados, incompletos, fueraDeFecha };
}

r.post("/revisar", async (req, res) => {
  const { filas, soloMes } = req.body || {};
  if (!Array.isArray(filas)) return res.status(400).json({ error: "Mandá un arreglo de fichas" });
  const r2 = await revisar(filas, { soloMes: soloMes || null });
  res.json({
    entran: r2.entran.slice(0, 500),
    totales: {
      entran: r2.entran.length,
      duplicados: r2.duplicados.length,
      incompletos: r2.incompletos.length,
      fueraDeFecha: r2.fueraDeFecha.length,
    },
    duplicados: r2.duplicados.slice(0, 100),
    incompletos: r2.incompletos.slice(0, 100),
  });
});

r.post("/confirmar", async (req, res) => {
  const { filas, soloMes } = req.body || {};
  if (!Array.isArray(filas)) return res.status(400).json({ error: "Mandá un arreglo de fichas" });
  const { entran } = await revisar(filas, { soloMes: soloMes || null });
  let creados = 0;
  const fallaron = [];
  for (const p of entran) {
    try {
      const { _fecha, ...datos } = p;
      await P.crear({ ...datos, proximoContacto: F.hoy() });
      creados += 1;
    } catch (e) {
      fallaron.push({ nombre: p.nombre, motivo: e.message });
    }
  }
  res.json({ creados, fallaron });
});

module.exports = r;
