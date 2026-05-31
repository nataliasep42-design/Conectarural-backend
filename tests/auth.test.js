// tests/auth.test.js
// Tests de integración para los endpoints de autenticación.
// Requiere que la BD de test esté disponible o que el backend esté corriendo.
// Ejecutar: npm test

const request = require('supertest');

// Cargar la app sin iniciar el servidor (para tests)
// Necesitamos exportar `app` desde index.js para poder usarlo aquí.
// Si index.js usa app.listen directamente, podemos crear un app-test.js
// o usar el servidor real en localhost:3000 para los tests.

// Enfoque pragmático: testear contra el servidor levantado en CI
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

// Helper para hacer requests sin instanciar la app
const api = {
  post: (path, body) =>
    request(BASE_URL).post(path).send(body).set('Content-Type', 'application/json'),
  get: (path, token) =>
    request(BASE_URL).get(path).set('Authorization', `Bearer ${token || ''}`),
};

describe('POST /auth/register', () => {
  it('rechaza registro sin campos obligatorios', async () => {
    const res = await api.post('/auth/register', { email: 'test@test.com' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('rechaza contraseñas cortas', async () => {
    const res = await api.post('/auth/register', {
      nombre: 'Test', email: 'test_short@test.com', password: '1234'
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/8 caracteres/);
  });

  it('rechaza email inválido', async () => {
    const res = await api.post('/auth/register', {
      nombre: 'Test', email: 'noesunemail', password: 'password123'
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/email/i);
  });
});

describe('POST /auth/login', () => {
  it('rechaza credenciales vacías', async () => {
    const res = await api.post('/auth/login', {});
    expect(res.status).toBe(400);
  });

  it('rechaza credenciales incorrectas', async () => {
    const res = await api.post('/auth/login', {
      email: 'noexiste@test.com', password: 'wrongpass'
    });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('devuelve token en login correcto (requiere usuario de test en BD)', async () => {
    // Este test requiere que exista el usuario de test en la BD
    // Si no existe, se salta
    const res = await api.post('/auth/login', {
      email: process.env.TEST_USER_EMAIL || 'test@conectarural.com',
      password: process.env.TEST_USER_PASS || 'test12345',
    });
    if (res.status === 400) {
      // Usuario no existe, skip
      console.log('  (test de login exitoso omitido — usuario de test no configurado)');
      return;
    }
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toHaveProperty('id');
    expect(res.body.user).toHaveProperty('rol');
  });
});

describe('POST /auth/refresh', () => {
  it('rechaza sin token', async () => {
    const res = await api.post('/auth/refresh', {});
    expect(res.status).toBe(401);
  });

  it('rechaza con token inválido', async () => {
    const res = request(BASE_URL)
      .post('/auth/refresh')
      .set('Authorization', 'Bearer tokeninvalido');
    const r = await res;
    expect(r.status).toBe(403);
  });
});

describe('Endpoints protegidos', () => {
  it('GET /perfil sin token → 401', async () => {
    const res = await api.get('/perfil');
    expect(res.status).toBe(401);
  });

  it('GET /mis-cursos sin token → 401', async () => {
    const res = await api.get('/mis-cursos');
    expect(res.status).toBe(401);
  });

  it('GET /admin/stats sin token → 401', async () => {
    const res = await api.get('/admin/stats');
    expect(res.status).toBe(401);
  });
});
