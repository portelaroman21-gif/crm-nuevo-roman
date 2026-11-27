"use strict";
const { Pool, types } = require("pg");

// Postgres devuelve bigint (COUNT, ts) como texto para no perder precisión.
// Acá los números entran cómodos en un number de JS, así que los parseamos.
types.setTypeParser(20, (v) => (v === null ? null : Number(v)));

// --- conexión -------------------------------------------------------------
// Una sola variable: DATABASE_URL. También se aceptan las PG* sueltas.
const URL = process.env.DATABASE_URL || "";

function configuracion() {
  if (URL) {
    const pideSsl = /[?&]sslmode=(require|verify-full|verify-ca)/i.test(URL) || process.env.PGSSL === "require";
    return { connectionString: URL, ssl: pideSsl ? { rejectUnauthorized: true } : false, max: 10 };
  }
  return {
    host: process.env.PGHOST || "localhost",
    port: Number(process.env.PGPORT) || 5432,
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD || "",
    database: process.env.PGDATABASE || "crm",
    ssl: process.env.PGSSL === "require" ? { rejectUnauthorized: true } : false,
    max: 10,
  };
}

const pool = new Pool(configuracion());
pool.on("error", (e) => console.error("Postgres cortó una conexión inactiva:", e.message));

// --- traducción del SQL ---------------------------------------------------
// Postgres pasa a minúsculas todo identificador sin comillas, así que
// queQuiere se convertiría en quequiere y las filas volverían con otra clave.
// Entonces entrecomillamos solos cualquier identificador en camelCase,
// sin tocar lo que esté adentro de comillas simples.
const CAMELLO = /\b([a-z_]+[A-Z]\w*)\b/g;

function entrecomillar(sql) {
  let salida = "";
  let resto = sql;
  while (resto.length) {
    const abre = resto.indexOf("'");
    if (abre === -1) { salida += resto.replace(CAMELLO, '"$1"'); break; }
    salida += resto.slice(0, abre).replace(CAMELLO, '"$1"');
    const cierra = resto.indexOf("'", abre + 1);
    if (cierra === -1) { salida += resto.slice(abre); break; }
    salida += resto.slice(abre, cierra + 1);
    resto = resto.slice(cierra + 1);
  }
  return salida;
}

// ? posicional y @nombre con nombre, los dos a $1, $2...
function traducir(sql, argumentos) {
  const porNombre = argumentos.length === 1 && argumentos[0] && typeof argumentos[0] === "object" && !Array.isArray(argumentos[0]);

  if (porNombre) {
    // Los @nombre se reemplazan ANTES de entrecomillar: si no, @queQuiere
    // terminaría como @"queQuiere" y dejaría de ser un parámetro.
    const objeto = argumentos[0];
    const valores = [];
    const vistos = new Map();
    const conNumeros = sql.replace(/@(\w+)/g, (_, nombre) => {
      if (!vistos.has(nombre)) {
        valores.push(objeto[nombre] === undefined ? null : objeto[nombre]);
        vistos.set(nombre, valores.length);
      }
      return `$${vistos.get(nombre)}`;
    });
    return { sql: entrecomillar(conNumeros), valores };
  }

  let n = 0;
  const convertido = entrecomillar(sql).replace(/\?/g, () => `$${++n}`);
  return { sql: convertido, valores: argumentos.slice(0, n) };
}

// Tablas con columna id, para devolver el id recién creado como hacía SQLite.
const CON_ID = new Set([
  "usuarios", "personas", "contactos", "plantilla", "bloques",
  "tildes", "sueltos", "agenda", "contenido", "eventos_mapa",
]);

function conRetorno(sql) {
  if (!/^\s*insert\s+into/i.test(sql) || /returning/i.test(sql)) return sql;
  const tabla = /^\s*insert\s+into\s+"?(\w+)"?/i.exec(sql);
  if (!tabla || !CON_ID.has(tabla[1].toLowerCase())) return sql;
  return `${sql.replace(/;\s*$/, "")} RETURNING id`;
}

async function consultar(ejecutor, sql, argumentos) {
  const { sql: texto, valores } = traducir(sql, argumentos);
  try {
    return await ejecutor.query(conRetorno(texto), valores);
  } catch (e) {
    e.message = `${e.message} — consulta: ${texto.slice(0, 240)}`;
    throw e;
  }
}

// Mismo gesto que better-sqlite3 (prepare().get/all/run) pero asincrónico,
// así el resto del sistema cambia poco.
function sentencia(ejecutor, sql) {
  return {
    get: async (...a) => (await consultar(ejecutor, sql, a)).rows[0],
    all: async (...a) => (await consultar(ejecutor, sql, a)).rows,
    run: async (...a) => {
      const r = await consultar(ejecutor, sql, a);
      return { changes: r.rowCount, lastInsertRowid: r.rows[0] ? r.rows[0].id : undefined };
    },
  };
}

const db = {
  prepare: (sql) => sentencia(pool, sql),
  ejecutar: (sql) => pool.query(sql),
  // Todo o nada: si algo falla, se deshace.
  transaccion: async (tarea) => {
    const cliente = await pool.connect();
    try {
      await cliente.query("BEGIN");
      const resultado = await tarea({ prepare: (sql) => sentencia(cliente, sql) });
      await cliente.query("COMMIT");
      return resultado;
    } catch (e) {
      try { await cliente.query("ROLLBACK"); } catch { /* la conexión ya se cayó */ }
      throw e;
    } finally {
      cliente.release();
    }
  },
  cerrar: () => pool.end(),
};

// --- esquema --------------------------------------------------------------
const ESQUEMA = `
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  hash TEXT NOT NULL,
  creado TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS personas (
  id SERIAL PRIMARY KEY,
  lista TEXT NOT NULL,
  nombre TEXT NOT NULL,
  telefono TEXT,
  clave TEXT,
  origen TEXT,
  "origenNota" TEXT,
  "esFrio" INTEGER NOT NULL DEFAULT 0,
  "queQuiere" TEXT,

  operacion TEXT,
  zona TEXT,
  rango TEXT,
  plazo TEXT,
  mostrado TEXT,

  direccion TEXT,
  "tipoPropiedad" TEXT,
  "precioPretendido" TEXT,
  "conOtra" INTEGER NOT NULL DEFAULT 0,
  "exclusivoHasta" TEXT,

  empresa TEXT,
  rol TEXT,
  "tipoLote" TEXT,
  superficie TEXT,
  "obraEnMarcha" INTEGER NOT NULL DEFAULT 0,

  importante INTEGER NOT NULL DEFAULT 0,
  frio INTEGER NOT NULL DEFAULT 0,
  "frioHasta" TEXT,
  cerrado INTEGER NOT NULL DEFAULT 0,
  "cerradoFecha" TEXT,
  "cerradoMonto" TEXT,
  "proximoPaso" TEXT,
  "proximoContacto" TEXT,
  "sinRespuesta" INTEGER NOT NULL DEFAULT 0,
  "origenMapa" INTEGER NOT NULL DEFAULT 0,
  creado TEXT NOT NULL,
  actualizado TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_personas_clave ON personas(clave) WHERE clave IS NOT NULL AND clave <> '';
CREATE INDEX IF NOT EXISTS idx_personas_lista ON personas(lista);
CREATE INDEX IF NOT EXISTS idx_personas_proximo ON personas("proximoContacto");

CREATE TABLE IF NOT EXISTS contactos (
  id SERIAL PRIMARY KEY,
  "personaId" INTEGER NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  canal TEXT NOT NULL,
  lista TEXT,
  nota TEXT,
  fecha TEXT NOT NULL,
  ts BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_contactos_fecha ON contactos(fecha);
CREATE INDEX IF NOT EXISTS idx_contactos_persona ON contactos("personaId");

CREATE TABLE IF NOT EXISTS plantilla (
  id SERIAL PRIMARY KEY,
  ambito TEXT NOT NULL,
  dia INTEGER NOT NULL,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL,
  hora TEXT NOT NULL,
  minutos INTEGER NOT NULL,
  objetivo INTEGER
);
CREATE INDEX IF NOT EXISTS idx_plantilla ON plantilla(ambito, dia);

CREATE TABLE IF NOT EXISTS dias (
  fecha TEXT PRIMARY KEY,
  armado INTEGER NOT NULL DEFAULT 0,
  cerrado INTEGER NOT NULL DEFAULT 0,
  nota TEXT
);

CREATE TABLE IF NOT EXISTS bloques (
  id SERIAL PRIMARY KEY,
  fecha TEXT NOT NULL,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL,
  hora TEXT NOT NULL,
  minutos INTEGER NOT NULL,
  objetivo INTEGER,
  fijo INTEGER NOT NULL DEFAULT 0,
  "agendaId" INTEGER,
  nota TEXT
);
CREATE INDEX IF NOT EXISTS idx_bloques_fecha ON bloques(fecha);

CREATE TABLE IF NOT EXISTS tildes (
  id SERIAL PRIMARY KEY,
  "bloqueId" INTEGER NOT NULL REFERENCES bloques(id) ON DELETE CASCADE,
  "personaId" INTEGER REFERENCES personas(id) ON DELETE CASCADE,
  "contenidoId" INTEGER,
  texto TEXT,
  fecha TEXT NOT NULL,
  ts BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tildes_fecha ON tildes(fecha);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tildes_bloque_persona ON tildes("bloqueId", "personaId") WHERE "personaId" IS NOT NULL;

CREATE TABLE IF NOT EXISTS sueltos (
  id SERIAL PRIMARY KEY,
  fecha TEXT NOT NULL,
  "bloqueId" INTEGER,
  texto TEXT NOT NULL,
  hecho INTEGER NOT NULL DEFAULT 0,
  creado TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sueltos_fecha ON sueltos(fecha);

CREATE TABLE IF NOT EXISTS agenda (
  id SERIAL PRIMARY KEY,
  fecha TEXT NOT NULL,
  hora TEXT NOT NULL,
  minutos INTEGER NOT NULL DEFAULT 60,
  titulo TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'visita',
  "personaId" INTEGER REFERENCES personas(id) ON DELETE SET NULL,
  lugar TEXT,
  hecho INTEGER NOT NULL DEFAULT 0,
  resultado TEXT,
  creado TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_agenda_fecha ON agenda(fecha);

CREATE TABLE IF NOT EXISTS contenido (
  id SERIAL PRIMARY KEY,
  titulo TEXT NOT NULL,
  etapa TEXT NOT NULL DEFAULT 'idea',
  formato TEXT,
  "fechaObjetivo" TEXT,
  link TEXT,
  nota TEXT,
  creado TEXT NOT NULL,
  actualizado TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contadores (
  fecha TEXT NOT NULL,
  clave TEXT NOT NULL,
  valor INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (fecha, clave)
);

CREATE TABLE IF NOT EXISTS eventos_mapa (
  id SERIAL PRIMARY KEY,
  tipo TEXT NOT NULL,
  "personaId" INTEGER REFERENCES personas(id) ON DELETE SET NULL,
  detalle TEXT,
  ts BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS config (
  clave TEXT PRIMARY KEY,
  valor TEXT
);
`;

// Cambios de esquema sobre bases que ya tienen datos. Cada uno tiene que
// poder correrse muchas veces sin romper nada.
const MIGRACIONES = `
ALTER TABLE personas ADD COLUMN IF NOT EXISTS "origenNota" TEXT;
ALTER TABLE personas ADD COLUMN IF NOT EXISTS "esFrio" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_personas_origen ON personas(origen);
`;

async function preparar() {
  // Si Postgres todavía no levantó (pasa en el primer deploy), reintentamos.
  for (let intento = 1; intento <= 12; intento += 1) {
    try {
      await pool.query("SELECT 1");
      break;
    } catch (e) {
      if (intento === 12) throw new Error(`No se pudo conectar a Postgres: ${e.message}`);
      console.log(`Esperando a Postgres (${intento}/12)…`);
      await new Promise((r) => setTimeout(r, 2500));
    }
  }
  await pool.query(ESQUEMA);
  await pool.query(MIGRACIONES);
}

async function leerConfig(clave, porDefecto = null) {
  const f = await db.prepare("SELECT valor FROM config WHERE clave = ?").get(clave);
  return f ? f.valor : porDefecto;
}

async function guardarConfig(clave, valor) {
  await db
    .prepare("INSERT INTO config (clave, valor) VALUES (?, ?) ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor")
    .run(clave, valor == null ? null : String(valor));
}

module.exports = { db, pool, preparar, leerConfig, guardarConfig, entrecomillar, traducir };
