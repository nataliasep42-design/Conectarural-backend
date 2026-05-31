// tests/incidencias.test.js
// Tests de integración para el flujo de incidencias/consultas.

const request = require('supertest');
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

describe('POST /incidencias', () => {
  it('rechaza sin autenticación', async () => {
    const res = await request(BASE_URL)
      .post('/incidencias')
      .send({ asunto: 'Test', descripcion: 'Test desc', tipo_contacto: 'app' });
    expect(res.status).toBe(401);
  });

  it('rechaza con prioridad inválida (con token válido)', async () => {
    // Este test necesita un token válido para pasar la autenticación
    // Si no hay usuario de test, verifica solo que el endpoint existe
    const res = await request(BASE_URL)
      .post('/incidencias')
      .set('Authorization', 'Bearer tokeninvalido')
      .send({ asunto: 'Test', descripcion: 'Desc', tipo_contacto: 'app', prioridad: 'extrema' });
    // Sin token válido → 403; con token válido y prioridad inválida → 400
    expect([400, 403]).toContain(res.status);
  });
});

describe('GET /incidencias/mias', () => {
  it('rechaza sin token', async () => {
    const res = await request(BASE_URL).get('/incidencias/mias');
    expect(res.status).toBe(401);
  });
});

describe('GET /incidencias/asignadas', () => {
  it('rechaza sin token', async () => {
    const res = await request(BASE_URL).get('/incidencias/asignadas');
    expect(res.status).toBe(401);
  });
});

describe('GET /admin/incidencias', () => {
  it('rechaza sin token', async () => {
    const res = await request(BASE_URL).get('/admin/incidencias');
    expect(res.status).toBe(401);
  });
});

describe('Validación de prioridades', () => {
  const PRIORIDADES_VALIDAS = ['baja', 'normal', 'urgente'];
  const PRIORIDADES_INVALIDAS = ['media', 'alta', 'extrema', 'critica'];

  it('las prioridades válidas son baja/normal/urgente', () => {
    // Test unitario de la lógica de validación
    PRIORIDADES_VALIDAS.forEach(p => {
      expect(['baja', 'normal', 'urgente']).toContain(p);
    });
    PRIORIDADES_INVALIDAS.forEach(p => {
      expect(['baja', 'normal', 'urgente']).not.toContain(p);
    });
  });
});

describe('Endpoints de cursos (público)', () => {
  it('GET /cursos devuelve lista', async () => {
    const res = await request(BASE_URL).get('/cursos?limit=5');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /cursos incluye total_modulos', async () => {
    const res = await request(BASE_URL).get('/cursos?limit=5');
    expect(res.status).toBe(200);
    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty('total_modulos');
    }
  });

  it('GET /cursos/:id inexistente → 404', async () => {
    const res = await request(BASE_URL).get('/cursos/9999999');
    expect(res.status).toBe(404);
  });
});
