# ConectaRural — Backend API

API REST del proyecto **ConectaRural**, plataforma de alfabetización digital para mujeres rurales. Desarrollada con Node.js, Express 5 y PostgreSQL; da servicio tanto a la aplicación móvil Flutter como al panel de gestión web.

---

## Tecnologías

| Paquete | Versión | Rol |
|---------|---------|-----|
| Node.js | ≥ 18 | Runtime |
| Express | ^5.2.1 | Framework HTTP |
| pg | ^8.20.0 | Driver PostgreSQL (pool) |
| jsonwebtoken | ^9.0.3 | Firma y verificación JWT |
| bcryptjs | ^3.0.3 | Hash de contraseñas |
| dotenv | ^17.4.2 | Variables de entorno |
| cors | ^2.8.6 | Cabeceras CORS |
| express-rate-limit | ^8.5.1 | Rate limiting |
| multer | ^1.4.5-lts.1 | Subida de archivos (vídeos, documentos) |
| firebase-admin | ^13.10.0 | Push notifications (FCM) |
| nodemon | ^3.1.14 | Hot-reload en desarrollo |
| jest + supertest | ^30.x / ^7.x | Tests de integración |

---

## Estructura del proyecto

```
conectarural-backend/
├── index.js                  ← Arranque, middlewares globales, registro de rutas
├── db.js                     ← Pool de conexiones PostgreSQL
├── fcm_service.js            ← Firebase Admin SDK — envío de push notifications
├── package.json
├── .env                      ← Variables de entorno (no subir a Git)
├── middleware/
│   ├── authMiddleware.js     ← Verifica JWT → adjunta req.user = { id, rol }
│   └── roleMiddleware.js     ← requireRol(...roles) → 403 si rol insuficiente
├── routes/
│   ├── admin.js              ← CRUD admin: usuarios, cursos, módulos, asignaciones, incidencias, logs
│   ├── auth.js               ← register, login, refresh, verify-password
│   ├── asignaciones.js       ← /tecnicos, /asignaciones, /mi-tecnico
│   ├── cursos.js             ← Catálogo público de cursos y módulos
│   ├── descargas.js          ← Registro de descargas offline
│   ├── fcm_tokens.js         ← POST/DELETE /fcm-token
│   ├── incidencias.js        ← CRUD incidencias (usuaria + técnica)
│   ├── inscripciones.js      ← Inscripción y progreso de cursos
│   ├── perfil.js             ← GET/PUT /perfil
│   ├── stats.js              ← GET /stats/resumen (solo admin)
│   └── usuarios.js           ← Listado y ficha de usuarios (solo admin)
└── uploads/
    ├── videos/               ← Vídeos subidos por el admin (max 500 MB)
    └── documentos/           ← PDFs, imágenes, presentaciones (max 50 MB)
```

---

## Requisitos previos

- Node.js ≥ 18 y npm
- PostgreSQL ≥ 14
- (Opcional) Cuenta de Firebase con FCM habilitado para notificaciones push

---

## Instalación

```bash
git clone https://github.com/TU-USUARIO/conectarural-backend.git
cd conectarural-backend
npm install
```

---

## Variables de entorno

Crea un archivo `.env` en la raíz con las siguientes variables:

```env
# Servidor
PORT=3000
NODE_ENV=development          # "production" desactiva /health y /test-db

# PostgreSQL
PGHOST=localhost
PGPORT=5432
PGDATABASE=conectarural_db
PGUSER=conectarural_user
PGPASSWORD=tu_password_aqui

# Autenticación — OBLIGATORIA, el servidor no arranca sin ella
JWT_SECRET=clave_secreta_minimo_32_caracteres

# Firebase Cloud Messaging (opcional — para notificaciones push)
# Pega aquí el JSON completo de la cuenta de servicio de Firebase Admin SDK
FCM_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}'
```

> **Importante:** nunca subas `.env` a Git. El servidor termina con error si `JWT_SECRET` no está definido.

---

## Scripts

```bash
npm run dev        # Desarrollo: nodemon con hot-reload (NODE_ENV=development)
npm start          # Producción: node index.js (NODE_ENV=production)
npm test           # Tests con Jest (NODE_ENV=test)
npm run test:watch # Tests en modo watch
```

---

## Puesta en marcha

1. Asegúrate de que PostgreSQL está corriendo y la base de datos existe.
2. Configura el archivo `.env` correctamente.
3. Inicia el servidor en modo desarrollo:

```bash
npm run dev
```

El servidor queda escuchando en `http://localhost:3000`.

En modo desarrollo puedes verificar el estado con:
- `GET /health` → `{ status: "ok" }`
- `GET /test-db` → `{ db: "ok", now: "..." }`

---

## Sistema de roles

| Rol | ID | Descripción |
|-----|----|-------------|
| usuaria | 1 | Usuaria rural — acceso a cursos, progreso, incidencias |
| técnica | 2 | Técnica de apoyo — gestiona consultas, ve sus usuarias |
| admin | 3 | Administradora — acceso completo al panel de gestión |

El registro público siempre crea usuarias con rol 1. Los roles 2 y 3 se asignan desde el panel de administración.

---

## Referencia de endpoints

Todas las rutas protegidas requieren la cabecera:
```
Authorization: Bearer <token>
```

### Autenticación — `/auth`

| Verbo | Ruta | Auth | Descripción |
|-------|------|------|-------------|
| POST | `/auth/register` | — | Registrar nueva usuaria (rol 1 siempre) |
| POST | `/auth/login` | — | Login — devuelve JWT (7 días) |
| POST | `/auth/refresh` | JWT | Renovar token sin contraseña |
| POST | `/auth/verify-password` | JWT | Verificar contraseña actual (para acciones sensibles) |

### Perfil — `/perfil`

| Verbo | Ruta | Rol | Descripción |
|-------|------|-----|-------------|
| GET | `/perfil` | 1,2,3 | Ver datos propios |
| PUT | `/perfil` | 1,2,3 | Actualizar teléfono y zona |

### Cursos y módulos

| Verbo | Ruta | Rol | Descripción |
|-------|------|-----|-------------|
| GET | `/cursos` | — | Catálogo público con paginación |
| GET | `/cursos/:id` | — | Detalle de curso con módulos |
| GET | `/cursos/:id/modulos` | — | Módulos activos de un curso |
| POST | `/cursos/:id/inscribirse` | 1,2,3 | Inscribirse en un curso |
| GET | `/mis-cursos` | 1,2,3 | Cursos en los que está inscrita |
| POST | `/modulos/:id/progreso` | 1,2,3 | Guardar progreso en un módulo (0–100 %) |
| GET | `/progreso/mis-cursos` | 1,2,3 | Progreso agrupado por curso |

### Descargas offline

| Verbo | Ruta | Rol | Descripción |
|-------|------|-----|-------------|
| POST | `/modulos/:id/descargas` | 1,2,3 | Registrar módulo como descargado |
| GET | `/mis-descargas` | 1,2,3 | Módulos descargados con metadatos |
| DELETE | `/modulos/:id/descargas` | 1,2,3 | Eliminar registro de descarga |

### Incidencias / Consultas

| Verbo | Ruta | Rol | Descripción |
|-------|------|-----|-------------|
| POST | `/incidencias` | 1,2,3 | Crear consulta (auto-asigna técnica activa) |
| GET | `/incidencias/mias` | 1,2,3 | Mis consultas enviadas |
| GET | `/incidencias/asignadas` | 2,3 | Consultas de mis usuarias asignadas |
| PUT | `/incidencias/:id` | 2,3 | Responder o cambiar estado |

### Asignaciones

| Verbo | Ruta | Rol | Descripción |
|-------|------|-----|-------------|
| GET | `/mi-tecnico` | 1,2,3 | Técnica de apoyo asignada |
| GET | `/asignaciones/tecnico/:id` | 2,3 | Usuarias asignadas a una técnica |

### Estadísticas

| Verbo | Ruta | Rol | Descripción |
|-------|------|-----|-------------|
| GET | `/stats/resumen` | 3 | Resumen filtrable por zona y fechas |

### Notificaciones push

| Verbo | Ruta | Rol | Descripción |
|-------|------|-----|-------------|
| POST | `/fcm-token` | 1,2,3 | Registrar token FCM del dispositivo |
| DELETE | `/fcm-token` | 1,2,3 | Eliminar token (logout) |

### Panel de administración — `/admin`

Todos los endpoints admin requieren `Authorization: Bearer <token>` con `rol = 3`, salvo los marcados con `2,3`.

| Verbo | Ruta | Rol | Descripción |
|-------|------|-----|-------------|
| GET | `/admin/stats` | 2,3 | Estadísticas generales del sistema |
| GET | `/admin/usuarias` | 2,3 | Listar usuarias con filtros |
| PUT | `/admin/usuarias/:id` | 3 | Cambiar rol o estado de una usuaria |
| GET | `/admin/tecnicas` | 2,3 | Listar técnicas |
| PUT | `/admin/tecnicas/:id/estado` | 3 | Activar o bloquear técnica |
| GET | `/admin/asignaciones` | 2,3 | Ver todas las asignaciones |
| POST | `/admin/asignaciones` | 3 | Crear asignación técnica ↔ usuaria |
| DELETE | `/admin/asignaciones/:id` | 3 | Eliminar asignación |
| GET | `/admin/incidencias` | 2,3 | Ver todas las incidencias del sistema |
| PUT | `/admin/incidencias/:id` | 2,3 | Responder o cambiar estado |
| POST | `/admin/cursos` | 3 | Crear curso |
| PUT | `/admin/cursos/:id` | 3 | Editar curso |
| DELETE | `/admin/cursos/:id` | 3 | Eliminar curso (cascade total) |
| POST | `/cursos/:id/modulos` | 3 | Crear módulo |
| PUT | `/modulos/:id` | 3 | Editar o reordenar módulo |
| DELETE | `/admin/modulos/:id` | 3 | Eliminar módulo |
| POST | `/admin/modulos/:id/video` | 3 | Subir vídeo (multipart, max 500 MB) |
| POST | `/admin/modulos/:id/documento` | 3 | Subir PDF/imagen/presentación (max 50 MB) |
| GET | `/admin/logs` | 3 | Registro de auditoría con paginación |

---

## Base de datos

Esquema principal de tablas:

```
usuario          — id_usuario, nombre, apellidos, email, pass_hash,
                   id_rol, estado, fecha_alta, fcm_token
rol              — id_rol (1=usuaria, 2=tecnica, 3=admin), nombre_rol
curso            — id_curso, titulo, descripcion, categoria, nivel, duracion, descargable
modulo           — id_modulo, id_curso, titulo, descripcion, orden, url_archivo, size_mb, updated_at
inscripcion      — id_usuario, id_curso, fecha, estado  [UNIQUE(id_usuario, id_curso)]
progreso         — id_usuario, id_modulo, porcentaje, completado, last_access  [PK compuesto]
descarga         — id_usuario, id_modulo, fecha_desc, estado_desc, size_desc   [UNIQUE]
asignacion_tecnico_usuaria — id_asignacion, id_tecnico, id_usuaria, fecha, estado, notas
incidencia       — id_incidencia, id_usuario, id_tecnico, asunto, descripcion,
                   respuesta, prioridad, estado, tipo_contacto, date_create
log_admin        — id_log, id_admin, accion, entidad, id_entidad, detalle, fecha
```

---

## Seguridad

- **JWT**: tokens de 7 días firmados con `JWT_SECRET`. El servidor termina si la variable no está definida.
- **Contraseñas**: hasheadas con `bcryptjs` (salt rounds = 10), nunca almacenadas en texto plano.
- **Rate limiting**: `/auth` limitado a 10 req/15 min por IP; resto de endpoints a 300 req/15 min.
- **Roles**: cada ruta declara explícitamente qué roles pueden acceder vía `requireRol(...)`.
- **SQL injection**: todas las queries usan prepared statements (`$1`, `$2`, …); sin concatenación de strings con valores de usuario.
- **Archivos subidos**: servidos con `express.static` desde `/uploads`. En producción se recomienda añadir autenticación o servir desde un CDN con tokens firmados.

---

## Notificaciones push (FCM)

Si `FCM_SERVICE_ACCOUNT_JSON` está definido, el backend envía notificaciones push automáticamente en estos eventos:

- Nueva consulta creada → notificación a la técnica asignada
- Técnica responde una consulta → notificación a la usuaria

Los fallos de FCM no interrumpen el flujo de la petición.

---

## Tests

```bash
npm test
```

Los tests usan Jest + Supertest contra una base de datos de prueba (`NODE_ENV=test`). Se ejecutan en serie (`--runInBand`) para evitar condiciones de carrera.

---

## .gitignore recomendado

```gitignore
node_modules/
.env
uploads/
*.log
npm-debug.log*
.vscode/
.DS_Store
Thumbs.db
```

> Los archivos subidos (`uploads/`) tampoco deben subirse al repositorio si se usa almacenamiento local.

---

## Autoras

**Natalia Betancur · Natalia Reguillón**  
Proyecto Final de Ciclo — Desarrollo de Aplicaciones Multiplataforma  
