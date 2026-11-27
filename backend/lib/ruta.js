"use strict";
const express = require("express");

// Express 4 no atrapa los errores de un handler asincrónico: si una promesa
// falla, la petición queda colgada. Este router envuelve cada handler para
// que cualquier error caiga en el manejador de errores del server.
function enrutador() {
  const r = express.Router();
  for (const metodo of ["get", "post", "patch", "put", "delete"]) {
    const original = r[metodo].bind(r);
    r[metodo] = (ruta, ...manejadores) =>
      original(
        ruta,
        ...manejadores.map((m) =>
          m.length >= 4
            ? m
            : (req, res, siguiente) => Promise.resolve(m(req, res, siguiente)).catch(siguiente)
        )
      );
  }
  return r;
}

module.exports = { enrutador };
