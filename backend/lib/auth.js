"use strict";
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { db } = require("../db.js");
const F = require("./fechas.js");

const SECRETO = process.env.JWT_SECRET || "";
if (!SECRETO) {
  console.error("Falta JWT_SECRET. El sistema no arranca sin esa variable.");
  process.exit(1);
}

function hashear(clave) {
  return bcrypt.hashSync(String(clave), 10);
}

function verificar(clave, hash) {
  try {
    return bcrypt.compareSync(String(clave), hash);
  } catch {
    return false;
  }
}

function firmar(usuario) {
  return jwt.sign({ id: usuario.id, email: usuario.email }, SECRETO, { expiresIn: "30d" });
}

async function hayUsuario() {
  const f = await db.prepare("SELECT COUNT(*) n FROM usuarios").get();
  return f.n > 0;
}

async function crearUsuario(email, clave) {
  const info = await db
    .prepare("INSERT INTO usuarios (email, hash, creado) VALUES (?, ?, ?)")
    .run(String(email).trim().toLowerCase(), hashear(clave), F.hoy());
  return db.prepare("SELECT id, email FROM usuarios WHERE id = ?").get(info.lastInsertRowid);
}

function buscarUsuario(email) {
  return db.prepare("SELECT * FROM usuarios WHERE email = ?").get(String(email).trim().toLowerCase());
}

function puerta(req, res, next) {
  const cabecera = req.headers.authorization || "";
  const token = cabecera.startsWith("Bearer ") ? cabecera.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Sin sesión" });
  try {
    req.usuario = jwt.verify(token, SECRETO);
    next();
  } catch {
    res.status(401).json({ error: "Sesión vencida" });
  }
}

module.exports = { hashear, verificar, firmar, hayUsuario, crearUsuario, buscarUsuario, puerta };
