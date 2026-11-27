"use strict";
const { enrutador } = require("../lib/ruta.js");
const { db } = require("../db.js");
const F = require("../lib/fechas.js");
const C = require("../lib/contadores.js");
const P = require("../lib/personas.js");

const r = enrutador();

r.get("/dia", async (req, res) => {
  const fecha = F.esFecha(req.query.fecha) ? req.query.fecha : F.hoy();
  const datos = await C.delDia(fecha);
  const pendientes = (await P.cola(fecha)).length;
  const manana = (await P.cola(F.sumarDias(fecha, 1))).length;
  const estado = await db.prepare("SELECT * FROM dias WHERE fecha = ?").get(fecha);
  res.json({ ...datos, manuales: C.MANUALES, pendientes, manana, cerrado: !!(estado && estado.cerrado) });
});

r.post("/sumar", async (req, res) => {
  const { clave, paso = 1 } = req.body || {};
  const fecha = F.esFecha((req.body || {}).fecha) ? req.body.fecha : F.hoy();
  try {
    res.json({ valor: await C.sumar(fecha, clave, Number(paso) || 1), clave, fecha });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

function proporcion(arriba, abajo) {
  if (!abajo) return null;
  return Math.round((arriba / abajo) * 100) / 10; // de cada 10
}

r.get("/reporte", async (req, res) => {
  const periodo = req.query.periodo === "mes" ? "mes" : "semana";
  const ancla = F.esFecha(req.query.fecha) ? req.query.fecha : F.hoy();

  let desde, hasta, desdeAntes, hastaAntes, titulo;
  if (periodo === "semana") {
    desde = F.lunesDe(ancla);
    hasta = F.sumarDias(desde, 6);
    desdeAntes = F.sumarDias(desde, -7);
    hastaAntes = F.sumarDias(desde, -1);
    titulo = `Semana del ${desde}`;
  } else {
    desde = F.primeroDelMes(ancla);
    hasta = F.ultimoDelMes(ancla);
    const mesAntes = F.sumarDias(desde, -1);
    desdeAntes = F.primeroDelMes(mesAntes);
    hastaAntes = F.ultimoDelMes(mesAntes);
    titulo = `Mes de ${desde.slice(0, 7)}`;
  }

  const ahora = await C.delRango(desde, hasta);
  const antes = await C.delRango(desdeAntes, hastaAntes);
  const origenes = await C.porOrigen(desde, hasta);

  const embudo = [
    {
      nombre: "De cada 10 prospecciones en frío, cuántos te contestaron",
      valor: proporcion(ahora.contestaron, ahora.frio),
      arriba: ahora.contestaron, abajo: ahora.frio,
      antes: proporcion(antes.contestaron, antes.frio),
      lectura: "Si acá el número es bajo, el problema es el mensaje.",
    },
    {
      nombre: "De cada 10 que te contestaron, cuántos calificaron",
      valor: proporcion(ahora.calificados, ahora.meHablaron),
      arriba: ahora.calificados, abajo: ahora.meHablaron,
      antes: proporcion(antes.calificados, antes.meHablaron),
      lectura: "Si acá el número es bajo, el problema es a quién le escribís.",
    },
    {
      nombre: "De cada 10 calificados, cuántas visitas saliste a hacer",
      valor: proporcion(ahora.visitasHechas, ahora.calificados),
      arriba: ahora.visitasHechas, abajo: ahora.calificados,
      antes: proporcion(antes.visitasHechas, antes.calificados),
      lectura: "Si acá el número es bajo, el problema es el cierre.",
    },
  ];

  const totales = [
    { nombre: "Contactos hechos", ahora: ahora.contactos, antes: antes.contactos },
    { nombre: "Seguimientos", ahora: ahora.seguimientos, antes: antes.seguimientos },
    { nombre: "Prospección en frío", ahora: ahora.frio, antes: antes.frio },
    { nombre: "Me hablaron", ahora: ahora.meHablaron, antes: antes.meHablaron },
    { nombre: "Llamadas", ahora: ahora.llamadas, antes: antes.llamadas },
    { nombre: "Localizados", ahora: ahora.localizados, antes: antes.localizados },
    { nombre: "Visitas hechas", ahora: ahora.visitasHechas, antes: antes.visitasHechas },
    { nombre: "Fichas nuevas", ahora: ahora.nuevos, antes: antes.nuevos },
    { nombre: "Cerrados", ahora: ahora.cerrados, antes: antes.cerrados },
  ];

  res.json({ periodo, titulo, desde, hasta, desdeAntes, hastaAntes, embudo, totales, origenes });
});

module.exports = r;
