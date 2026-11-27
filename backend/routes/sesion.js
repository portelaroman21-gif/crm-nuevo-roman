"use strict";
const { enrutador } = require("../lib/ruta.js");
const A = require("../lib/auth.js");

const r = enrutador();

r.get("/estado", async (req, res) => {
  res.json({ instalado: await A.hayUsuario() });
});

r.post("/instalar", async (req, res) => {
  if (await A.hayUsuario()) return res.status(409).json({ error: "Ya hay un usuario creado" });
  const { email, clave } = req.body || {};
  if (!email || !clave || String(clave).length < 6)
    return res.status(400).json({ error: "Mail y clave de al menos 6 caracteres" });
  const usuario = await A.crearUsuario(email, clave);
  res.json({ token: A.firmar(usuario), usuario });
});

r.post("/entrar", async (req, res) => {
  const { email, clave } = req.body || {};
  const usuario = await A.buscarUsuario(email || "");
  if (!usuario || !A.verificar(clave || "", usuario.hash))
    return res.status(401).json({ error: "Mail o clave incorrectos" });
  res.json({ token: A.firmar(usuario), usuario: { id: usuario.id, email: usuario.email } });
});

r.post("/clave", A.puerta, async (req, res) => {
  const { actual, nueva } = req.body || {};
  const usuario = await A.buscarUsuario(req.usuario.email);
  if (!usuario || !A.verificar(actual || "", usuario.hash))
    return res.status(401).json({ error: "La clave actual no coincide" });
  if (!nueva || String(nueva).length < 6)
    return res.status(400).json({ error: "La clave nueva necesita 6 caracteres" });
  const { db } = require("../db.js");
  await db.prepare("UPDATE usuarios SET hash = ? WHERE id = ?").run(A.hashear(nueva), usuario.id);
  res.json({ ok: true });
});

module.exports = r;
