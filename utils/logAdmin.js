// utils/logAdmin.js
// Helper para registrar acciones de administración en log_admin.
// Falla silenciosamente: nunca interrumpe el flujo principal.

const { query } = require('../db');

/**
 * Registra una acción de admin en log_admin.
 * @param {number} idAdmin   - id del admin que realiza la acción
 * @param {string} accion    - descripción breve ("cambiar_rol", "bloquear_usuaria", etc.)
 * @param {string} entidad   - tabla afectada ("usuario", "incidencia", etc.)
 * @param {number} idEntidad - id del registro afectado
 * @param {string} detalle   - info adicional (valor anterior, nuevo valor, etc.)
 */
async function logAdmin(idAdmin, accion, entidad = null, idEntidad = null, detalle = null) {
  try {
    await query(
      `INSERT INTO log_admin (id_admin, accion, entidad, id_entidad, detalle)
       VALUES ($1, $2, $3, $4, $5)`,
      [idAdmin, accion, entidad, idEntidad, detalle]
    );
  } catch (err) {
    // No propagar el error: el log no debe interrumpir la operación principal
    console.error('log_admin: error al registrar —', err.message);
  }
}

module.exports = { logAdmin };
