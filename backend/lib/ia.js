"use strict";
const { db, leerConfig, guardarConfig } = require("../db.js");
const F = require("./fechas.js");
const P = require("./personas.js");
const D = require("./dia.js");
const C = require("./contadores.js");

const POR_DEFECTO = { baseUrl: "https://api.openai.com/v1", modelo: "gpt-4o-mini" };

// Algunos modelos piden o rechazan parametros sueltos. Lo aprendemos del error
// y lo recordamos, en vez de mandar temperatura y demas a ciegas.
const aprendido = new Map();
const INTOCABLES = new Set(["model", "messages"]);

async function configuracion() {
  const apiKey = await leerConfig("ia_api_key", "");
  return {
    baseUrl: await leerConfig("ia_base_url", POR_DEFECTO.baseUrl),
    modelo: await leerConfig("ia_modelo", POR_DEFECTO.modelo),
    apiKey,
    configurada: !!apiKey,
  };
}

async function guardar({ baseUrl, modelo, apiKey }) {
  if (baseUrl !== undefined) await guardarConfig("ia_base_url", String(baseUrl || "").trim() || POR_DEFECTO.baseUrl);
  if (modelo !== undefined) await guardarConfig("ia_modelo", String(modelo || "").trim() || POR_DEFECTO.modelo);
  if (apiKey !== undefined && String(apiKey).trim() !== "") await guardarConfig("ia_api_key", String(apiKey).trim());
  return configuracion();
}

async function pedir(mensajes) {
  const cfg = await configuracion();
  if (!cfg.apiKey) throw new Error("Todavía no cargaste la API key en Ajustes");

  const url = cfg.baseUrl.replace(/\/+$/, "") + "/chat/completions";
  const llave = `${cfg.baseUrl}|${cfg.modelo}`;
  const ajuste = aprendido.get(llave) || { poner: {}, sacar: new Set() };

  for (let intento = 0; intento < 4; intento += 1) {
    const cuerpo = { model: cfg.modelo, messages: mensajes, ...ajuste.poner };
    for (const fuera of ajuste.sacar) if (!INTOCABLES.has(fuera)) delete cuerpo[fuera];

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify(cuerpo),
    });

    if (r.ok) {
      const datos = await r.json();
      aprendido.set(llave, ajuste);
      const texto = datos?.choices?.[0]?.message?.content;
      if (!texto) throw new Error("El proveedor contestó vacío");
      return texto.trim();
    }

    const texto = await r.text();
    if (r.status === 400) {
      const pedido = /set (\w+) to '([^']+)'/i.exec(texto);
      const sobra = /Unsupported (?:value|parameter): '([^']+)'/i.exec(texto);
      if (pedido && !INTOCABLES.has(pedido[1])) {
        ajuste.poner[pedido[1]] = pedido[2];
        aprendido.set(llave, ajuste);
        continue;
      }
      if (sobra && !INTOCABLES.has(sobra[1])) {
        ajuste.sacar.add(sobra[1]);
        delete ajuste.poner[sobra[1]];
        aprendido.set(llave, ajuste);
        continue;
      }
    }
    throw new Error(`El proveedor devolvió ${r.status}. ${texto.slice(0, 400)}`);
  }
  throw new Error("No se pudo hablar con el proveedor después de varios intentos");
}

// Todo lo que la IA necesita saber, en texto corto. No le damos la base entera.
async function panorama(fecha = F.hoy()) {
  const dia = await D.delDia(fecha);
  const numeros = await C.delDia(fecha);
  const semana = await C.delRango(F.lunesDe(fecha), fecha);
  const cola = (await P.cola(fecha)).slice(0, 25);

  const porLista = await db
    .prepare("SELECT lista, COUNT(*) n FROM personas WHERE cerrado = 0 AND frio = 0 GROUP BY lista")
    .all();
  const citas = await db.prepare("SELECT * FROM agenda WHERE fecha >= ? ORDER BY fecha, hora LIMIT 10").all(fecha);
  const vencidos = (
    await db.prepare("SELECT COUNT(*) n FROM personas WHERE cerrado = 0 AND frio = 0 AND proximoContacto < ?").get(fecha)
  ).n;
  const exclusivos = await db
    .prepare(
      "SELECT nombre, direccion, exclusivoHasta FROM personas WHERE lista = 'captacion' AND exclusivoHasta IS NOT NULL AND exclusivoHasta <= ? ORDER BY exclusivoHasta LIMIT 8"
    )
    .all(F.sumarDias(fecha, 30));

  const lineas = [];
  lineas.push(`Hoy es ${fecha}.`);
  lineas.push(
    `Listas activas: ${porLista.map((l) => `${P.NOMBRE_LISTA[l.lista] || l.lista} ${l.n}`).join(", ") || "vacías"}.`
  );
  lineas.push(`Atrasados (fecha de contacto vencida): ${vencidos}.`);
  lineas.push(
    `Bloques de hoy: ${dia.bloques.map((b) => `${b.hora} ${b.nombre} (${b.minutos}min)`).join(" | ") || "ninguno"}.`
  );
  if (dia.afuera.length) lineas.push(`Quedaron fuera del día: ${dia.afuera.map((b) => b.nombre).join(", ")}.`);
  lineas.push(
    `Números de hoy: ${numeros.numeros.map((n) => `${n.nombre} ${n.valor}`).join(", ")}.`
  );
  lineas.push(
    `Semana hasta hoy: ${semana.frio} prospecciones en frío, ${semana.contestaron} contestaron, ${semana.calificados} calificados, ${semana.visitasHechas} visitas hechas.`
  );
  if (citas.length)
    lineas.push(
      `Agenda próxima: ${citas.map((c) => `${c.fecha} ${c.hora} ${c.titulo}`).join(" | ")}.`
    );
  if (exclusivos.length)
    lineas.push(
      `Exclusivos por vencer: ${exclusivos.map((e) => `${e.nombre} (${e.exclusivoHasta})`).join(", ")}.`
    );
  lineas.push("Cola de hoy, en orden:");
  for (const p of cola) {
    const partes = [
      `${p.nombre} [${P.NOMBRE_LISTA[p.lista]}]`,
      p.atraso > 0 ? `${p.atraso} días de atraso` : "para hoy",
      p.importante ? "marcado importante" : null,
      p.proximoPaso ? `próximo paso: ${p.proximoPaso}` : null,
      p.queQuiere ? `busca: ${p.queQuiere}` : null,
      p.zona ? `zona ${p.zona}` : null,
      p.sinRespuesta > 0 ? `${p.sinRespuesta} intentos sin respuesta` : null,
    ].filter(Boolean);
    lineas.push("- " + partes.join(" · "));
  }
  return lineas.join("\n");
}

const SISTEMA = `Sos el asistente de Román Portela, asesor inmobiliario en San Miguel, Buenos Aires.
Trabajás sobre los datos reales de su CRM que te pasan abajo. Reglas:
- Hablás en español rioplatense, de vos, directo y corto.
- No redactás mensajes para clientes salvo que te lo pidan explícitamente.
- Tu trabajo es decir por dónde empezar y por qué, con nombres concretos de la cola.
- Si algo no está en los datos, decís que no lo sabés. No inventás nombres, números ni fechas.
- Nada de listas de diez puntos: tres o cuatro cosas, la más importante primero.`;

async function consultar(pregunta, fecha = F.hoy()) {
  const datos = await panorama(fecha);
  return pedir([
    { role: "system", content: SISTEMA },
    { role: "user", content: `Datos del sistema:\n\n${datos}\n\nPregunta: ${pregunta}` },
  ]);
}

async function porDondeEmpezar(fecha = F.hoy()) {
  const datos = await panorama(fecha);
  return pedir([
    { role: "system", content: SISTEMA },
    {
      role: "user",
      content: `Datos del sistema:\n\n${datos}\n\nDecime por dónde empezar hoy. Nombrá personas concretas de la cola y por qué esa y no otra. Si ves algo que se está por perder (un exclusivo que vence, alguien con muchos intentos sin respuesta, una visita sin preparar), avisame.`,
    },
  ]);
}

async function probar() {
  const texto = await pedir([
    { role: "system", content: "Contestá con una sola palabra." },
    { role: "user", content: "Decí: listo" },
  ]);
  return texto;
}

module.exports = { configuracion, guardar, panorama, consultar, porDondeEmpezar, probar };
