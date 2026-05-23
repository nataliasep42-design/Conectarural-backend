// routes/auth.js
 
const express = require('express');
const router = express.Router();
const { query } = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
 
// POST /auth/register -------------------------------------------------
router.post('/register', async (req, res) => {
  const { nombre, apellidos, email, telefono, password, zona } = req.body;
  // NOTA: id_rol se ignora del body — el registro público siempre crea
  // una usuaria (rol 1). Los roles 2 (técnica) y 3 (admin) solo se
  // asignan desde el backoffice por un administrador.
  // Si se enviara id_rol: 3 en el body, se ignoraría.
 
  // ── Validaciones ─────────────────────────────────────────
  if (!nombre || !email || !password) {
    return res.status(400).json({ error: 'Faltan campos obligatorios: nombre, email, password' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
  }
  // Validación básica de formato email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Formato de email inválido' });
  }
 
  try {
    // Comprobar si el email ya existe
    const userExists = await query(
      'SELECT id_usuario FROM usuario WHERE email = $1',
      [email]
    );
    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'El email ya está registrado' });
    }
 
    // Hashear contraseña
    const salt = await bcrypt.genSalt(10);
    const passHash = await bcrypt.hash(password, salt);
 
    // Insertar — rol siempre 1 (usuaria), nunca del body
    const sql = `
      INSERT INTO usuario (nombre, apellidos, email, telefono, pass_hash, zona, id_rol)
      VALUES ($1, $2, $3, $4, $5, $6, 1)
      RETURNING id_usuario;
    `;
    const result = await query(sql, [nombre, apellidos, email, telefono, passHash, zona]);
 
    res.status(201).json({
      message: 'Usuario registrado con éxito',
      id: result.rows[0].id_usuario
    });
  } catch (error) {
    console.error('Error al registrar usuario:', error);
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
});
 
 
// POST /auth/login -----------------------------------------------------
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
 
  // Validaciones básicas
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son obligatorios' });
  }
 
  try {
    const result = await query('SELECT * FROM usuario WHERE email = $1', [email]);
    const user = result.rows[0];
 
    // Mismo mensaje para email no encontrado y contraseña incorrecta
    // (evita enumerar qué emails existen en el sistema)
    if (!user) {
      return res.status(400).json({ error: 'Email o contraseña incorrectos' });
    }
 
    // Verificar que la cuenta esté activa
    // Una usuaria desactivada desde el backoffice no puede entrar
    if (user.estado !== 'activo') {
      return res.status(403).json({
        error: 'Tu cuenta está desactivada. Contacta con el administrador.'
      });
    }
 
    // Comparar contraseña con el hash
    const isMatch = await bcrypt.compare(password, user.pass_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Email o contraseña incorrectos' });
    }
 
    // Generar JWT con id y rol
    // 8h en lugar de 1h para mejor experiencia: no hay que volver a entrar
    // cada hora mientras se usa la app
    const token = jwt.sign(
      { id: user.id_usuario, rol: user.id_rol },
      process.env.JWT_SECRET || 'tu_secreto_muy_seguro',
      { expiresIn: '7d' }
    );
 
    res.json({
      message: 'Login exitoso',
      token,
      user: {
        id:     user.id_usuario,
        nombre: user.nombre,
        rol:    user.id_rol      // Flutter lo necesita para mostrar la vista correcta
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error en el login' });
  }
});
 
module.exports = router;