// routes/fcm_tokens.js
// Registrar y eliminar tokens FCM de dispositivo

const express = require('express');
const router = express.Router();
const { query } = require('../db');
const authenticateToken = require('../middleware/authMiddleware');

// POST /fcm-token  — guardar token del dispositivo
router.post('/fcm-token', authenticateToken, async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'token es obligatorio' });
  try {
    await query(
      `UPDATE usuario SET fcm_token = $1 WHERE id_usuario = $2`,
      [token, req.user.id]
    );
    res.json({ message: 'Token FCM registrado' });
  } catch (err) {
    console.error('Error guardando FCM token:', err);
    res.status(500).json({ error: 'Error al guardar el token' });
  }
});

// DELETE /fcm-token  — borrar token (logout)
router.delete('/fcm-token', authenticateToken, async (req, res) => {
  try {
    await query(
      `UPDATE usuario SET fcm_token = NULL WHERE id_usuario = $1`,
      [req.user.id]
    );
    res.json({ message: 'Token FCM eliminado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar el token' });
  }
});

module.exports = router;
