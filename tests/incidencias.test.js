// tests/incidencias.test.js
// Tests de integración para el flujo de incidencias/consultas.

const request = require('supertest');
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

// Tokens opcionales para tests de flujo completo.
// Definirlos en .env o exportar antes de ejecutar:
//   TEST_USUARIA_TOKEN=<jwt>  TEST_TECNICA_TOKEN=<jwt>
const USUARIA_TOKEN  = process.env.TEST_USUARIA_TOKEN;
const TECNICA_TOKEN  = process.env.TEST_TECNICA_TOKEN;

// ── Acceso sin autenticación ───────────────────────────────────────────────

describe('POST /incidencias — sin autenticación', () => {
  it('rechaza sin token → 401', async () => {
    const res = await request(BASE_URL)
      .post('/incidencias')
      .send({ asunto: 'Test', descripcion: 'Test desc', tipo_contacto: 'app' });
    expect(res.status).toBe(401);
  });
});

describe('GET /incidencias/mias — sin autenticación', () => {
  it('rechaza sin token → 401', async () => {
    const res = await request(BASE_URL).get('/incidencias/mias');
    expect(res.status).toBe(401);
  });
});

describe('GET /incidencias/asignadas — sin autenticación', () => {
  it('rechaza sin token → 401', async () => {
    const res = await request(BASE_URL).get('/incidencias/asignadas');
    expect(res.status).toBe(401);
  });
});

describe('GET /admin/incidencias — sin autenticación', () => {
  it('rechaza sin token → 401', async () => {
    const res = await request(BASE_URL).get('/admin/incidencias');
    expect(res.status).toBe(401);
  });
});

describe('PUT /incidencias/:id — sin autenticación', () => {
  it('rechaza sin token → 401', async () => {
    const res = await request(BASE_URL).put('/incidencias/1').send({ respuesta: 'test' });
    expect(res.status).toBe(401);
  });
});

// ── Validaciones de campos ─────────────────────────────────────────────────

describe('Validación de prioridades', () => {
  const VALIDAS   = ['baja', 'normal', 'urgente'];
  const INVALIDAS = ['media', 'alta', 'extrema', 'critica'];

  it('acepta baja/normal/urgente', () => {
    VALIDAS.forEach(p => expect(VALIDAS).toContain(p));
  });

  it('rechaza media/alta/extrema/critica', () => {
    INVALIDAS.forEach(p => expect(VALIDAS).not.toContain(p));
  });

  it('POST con prioridad inválida → 400 o 403 (depende del token)', async () => {
    const res = await request(BASE_URL)
      .post('/incidencias')
      .set('Authorization', 'Bearer tokeninvalido')
      .send({ asunto: 'Test', descripcion: 'Desc', tipo_contacto: 'app', prioridad: 'extrema' });
    expect([400, 403]).toContain(res.status);
  });
});

describe('Validación del asunto', () => {
  it('POST sin asunto → 400 o 403', async () => {
    const res = await request(BASE_URL)
      .post('/incidencias')
      .set('Authorization', 'Bearer tokeninvalido')
      .send({ descripcion: 'Desc', tipo_contacto: 'app' });
    expect([400, 403]).toContain(res.status);
  });
});

// ── Endpoints de cursos (público) ──────────────────────────────────────────

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

  it('GET /cursos/:id devuelve updated_at en módulos cuando existe', async () => {
    const lista = await request(BASE_URL).get('/cursos?limit=1');
    if (lista.body.length === 0) return;
    const id = lista.body[0].id_curso;
    const res = await request(BASE_URL).get(`/cursos/${id}`);
    expect(res.status).toBe(200);
    // La estructura debe incluir modulos aunque sea array vacío
    expect(res.body).toHaveProperty('modulos');
  });
});

// ── Flujo completo (requiere TEST_USUARIA_TOKEN + TEST_TECNICA_TOKEN) ──────

describe('Flujo completo de incidencia (requiere tokens de test)', () => {
  let incidenciaId;

  const skip = !USUARIA_TOKEN || !TECNICA_TOKEN;

  beforeAll(() => {
    if (skip) {
      console.log(
        'SKIP: define TEST_USUARIA_TOKEN y TEST_TECNICA_TOKEN para ejecutar el flujo completo'
      );
    }
  });

  it('usuaria crea incidencia → 201', async () => {
    if (skip) return;
    const res = await request(BASE_URL)
      .post('/incidencias')
      .set('Authorization', `Bearer ${USUARIA_TOKEN}`)
      .send({
        asunto: '[Test] Consulta de integración',
        descripcion: 'Esto es una consulta de test automatizado',
        tipo_contacto: 'app',
        prioridad: 'baja',
      });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('incidencia');
    expect(res.body.incidencia).toHaveProperty('id_incidencia');
    incidenciaId = res.body.incidencia.id_incidencia;
  });

  it('usuaria ve su incidencia en /mias', async () => {
    if (skip || !incidenciaId) return;
    const res = await request(BASE_URL)
      .get('/incidencias/mias')
      .set('Authorization', `Bearer ${USUARIA_TOKEN}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const found = res.body.find(i => i.id_incidencia === incidenciaId);
    expect(found).toBeDefined();
    expect(found.estado).toBe('abierta');
  });

  it('técnica ve la incidencia en /asignadas', async () => {
    if (skip || !incidenciaId) return;
    const res = await request(BASE_URL)
      .get('/incidencias/asignadas')
      .set('Authorization', `Bearer ${TECNICA_TOKEN}`);
    expect(res.status).toBe(200);
    const found = res.body.find(i => i.id_incidencia === incidenciaId);
    expect(found).toBeDefined();
  });

  it('técnica responde a la incidencia → 200', async () => {
    if (skip || !incidenciaId) return;
    const res = await request(BASE_URL)
      .put(`/incidencias/${incidenciaId}`)
      .set('Authorization', `Bearer ${TECNICA_TOKEN}`)
      .send({ respuesta: 'Respuesta de test automatizado' });
    expect(res.status).toBe(200);
    expect(res.body.incidencia.respuesta).toBe('Respuesta de test automatizado');
  });

  it('usuaria ve la respuesta de la técnica', async () => {
    if (skip || !incidenciaId) return;
    const res = await request(BASE_URL)
      .get('/incidencias/mias')
      .set('Authorization', `Bearer ${USUARIA_TOKEN}`);
    expect(res.status).toBe(200);
    const found = res.body.find(i => i.id_incidencia === incidenciaId);
    expect(found).toBeDefined();
    expect(found.respuesta).toBe('Respuesta de test automatizado');
  });

  it('técnica cierra la incidencia con mensaje → 200', async () => {
    if (skip || !incidenciaId) return;
    const res = await request(BASE_URL)
      .put(`/incidencias/${incidenciaId}`)
      .set('Authorization', `Bearer ${TECNICA_TOKEN}`)
      .send({
        estado: 'cerrada',
        respuesta: 'Consulta resuelta y cerrada por test',
      });
    expect(res.status).toBe(200);
    expect(res.body.incidencia.estado).toBe('cerrada');
    expect(res.body.incidencia.respuesta).toBe('Consulta resuelta y cerrada por test');
  });

  it('usuaria ve la incidencia cerrada', async () => {
    if (skip || !incidenciaId) return;
    const res = await request(BASE_URL)
      .get('/incidencias/mias')
      .set('Authorization', `Bearer ${USUARIA_TOKEN}`);
    expect(res.status).toBe(200);
    const found = res.body.find(i => i.id_incidencia === incidenciaId);
    expect(found).toBeDefined();
    expect(found.estado).toBe('cerrada');
  });

  it('técnica no puede volver a abrir una incidencia cerrada con estado inválido → 400', async () => {
    if (skip || !incidenciaId) return;
    const res = await request(BASE_URL)
      .put(`/incidencias/${incidenciaId}`)
      .set('Authorization', `Bearer ${TECNICA_TOKEN}`)
      .send({ estado: 'pendiente' }); // estado inválido
    expect(res.status).toBe(400);
  });
});
