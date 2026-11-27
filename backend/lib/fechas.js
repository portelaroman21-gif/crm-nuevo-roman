"use strict";
// Argentina es UTC-3 todo el ano (no hay horario de verano desde 2009).
// El contenedor corre en UTC, asi que nunca usamos 'localtime' de SQLite.
const OFFSET_MIN = -180;

function ahora() {
  return Date.now();
}

function hoy(ts = ahora()) {
  return new Date(ts + OFFSET_MIN * 60000).toISOString().slice(0, 10);
}

function horaDe(ts = ahora()) {
  return new Date(ts + OFFSET_MIN * 60000).toISOString().slice(11, 16);
}

// Una fecha YYYY-MM-DD se ancla al mediodia UTC para que sumar dias
// nunca cruce de mes por un tema de husos.
function aMs(fecha) {
  return Date.parse(`${fecha}T12:00:00Z`);
}

function sumarDias(fecha, dias) {
  return new Date(aMs(fecha) + dias * 86400000).toISOString().slice(0, 10);
}

function diferenciaDias(desde, hasta) {
  return Math.round((aMs(hasta) - aMs(desde)) / 86400000);
}

// 1 = lunes ... 7 = domingo
function diaSemana(fecha) {
  const d = new Date(aMs(fecha)).getUTCDay();
  return d === 0 ? 7 : d;
}

function lunesDe(fecha) {
  return sumarDias(fecha, -(diaSemana(fecha) - 1));
}

function primeroDelMes(fecha) {
  return `${fecha.slice(0, 7)}-01`;
}

function ultimoDelMes(fecha) {
  const [a, m] = fecha.split("-").map(Number);
  const dias = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return `${fecha.slice(0, 7)}-${String(dias).padStart(2, "0")}`;
}

function esFecha(v) {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(aMs(v));
}

function esHora(v) {
  return typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

function minutosDe(hora) {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

function horaDesdeMinutos(min) {
  const m = Math.max(0, Math.min(24 * 60 - 1, Math.round(min)));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

const DIAS = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

module.exports = {
  OFFSET_MIN, ahora, hoy, horaDe, aMs, sumarDias, diferenciaDias, diaSemana,
  lunesDe, primeroDelMes, ultimoDelMes, esFecha, esHora, minutosDe, horaDesdeMinutos, DIAS,
};
