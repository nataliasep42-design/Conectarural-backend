// routes/auth.js

const express = require('express');
const router = express.Router();
const { query } = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sendWelcomeEmail } = require('../services/emailService');
 
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
 
    // Correo de bienvenida — fire-and-forget, no bloquea ni rompe el registro
    sendWelcomeEmail(nombre, email).catch(err =>
      console.error('[email] Error al enviar bienvenida:', err)
    );

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
    if (user.estado !== 'activo') {
      const msg = user.estado === 'bloqueado'
        ? 'Tu cuenta ha sido bloqueada. Contacta con el administrador.'
        : 'Tu cuenta está desactivada. Contacta con el administrador.';
      return res.status(403).json({ error: msg });
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
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
 
    res.json({
      message: 'Login exitoso',
      token,
      user: {
        id:     user.id_usuario,
        nombre: user.nombre,
        email:  user.email,
        rol:    user.id_rol
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error en el login' });
  }
});
 

// POST /auth/refresh ---------------------------------------------------
// Renueva el JWT de la sesión activa sin volver a pedir contraseña.
// Solo requiere un token válido en el header Authorization.
const authenticateToken = require('../middleware/authMiddleware');

router.post('/refresh', authenticateToken, async (req, res) => {
  try {
    const newToken = jwt.sign(
      { id: req.user.id, rol: req.user.rol },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token: newToken, message: 'Token renovado' });
  } catch (error) {
    console.error('Error al renovar token:', error);
    res.status(500).json({ error: 'Error al renovar el token' });
  }
});

// POST /auth/verify-password ------------------------------------------
// Verifica la contraseña del usuario autenticado (para confirmar acciones sensibles).
// Requiere JWT válido. Devuelve { ok: true } si la contraseña coincide.
router.post('/verify-password', authenticateToken, async (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'Se requiere el campo password' });
  }
  try {
    const result = await query(
      'SELECT pass_hash FROM usuario WHERE id_usuario = $1',
      [req.user.id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    const valid = await bcrypt.compare(password, result.rows[0].pass_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }
    res.json({ ok: true });
  } catch (error) {
    console.error('Error en verify-password:', error);
    res.status(500).json({ error: 'Error al verificar la contraseña' });
  }
});

module.exports = router;