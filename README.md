# ConectaRural Backend

Backend API de **ConectaRural**, desarrollado con Node.js, Express y PostgreSQL como capa intermedia entre la aplicación móvil, la web de gestión y la base de datos del proyecto.

## Descripción

Este backend centraliza la lógica de negocio del sistema y gestiona funcionalidades como autenticación, usuarios y roles, cursos y módulos, progreso, descargas, incidencias, asignaciones entre técnicas y usuarias, y estadísticas básicas.

La API sigue una arquitectura modular y está pensada para servir como punto de unión entre las interfaces cliente y PostgreSQL, evitando el acceso directo a la base de datos desde la app Flutter o futuras interfaces web.

## Tecnologías utilizadas

- Node.js.
- Express.
- PostgreSQL.
- `pg` para la conexión con la base de datos.
- `dotenv` para variables de entorno.
- `cors` para permitir peticiones desde clientes externos durante el desarrollo.
- `bcryptjs` para el hash de contraseñas.
- `jsonwebtoken` para autenticación basada en JWT.
- `nodemon` para ejecución en desarrollo con reinicio automático.
  
## Estructura orientativa del proyecto

```bash
conectarural-backend/
├── index.js
├── db.js
├── package.json
├── .env.example
├── .gitignore
├── middleware/
│   ├── AuthMiddleware.js
│   └── RoleMiddleware.js
├── routes/
│   └── routes.js
└── sql/
    └── schema.sql
```

La memoria del proyecto describe una versión final del backend organizada en torno a un archivo de arranque (`index.js`), un módulo de conexión con PostgreSQL (`db.js`), middlewares de autenticación y autorización por rol, y rutas agrupadas por dominio funcional.

## Requisitos previos

Antes de ejecutar el proyecto, es necesario tener instalado lo siguiente:

- Node.js y npm. [file:2]
- PostgreSQL. [file:2]
- Un editor como Visual Studio Code y, opcionalmente, Postman para probar endpoints.

## Instalación

1. Clonar el repositorio:

```bash
git clone https://github.com/TU-USUARIO/Conectarural-backend.git
cd Conectarural-backend
```

2. Instalar dependencias:

```bash
npm install
```

La configuración base descrita en la memoria parte de `npm init -y` y de la instalación de `express`, `pg`, `cors`, `dotenv` y `nodemon`, ampliándose después con librerías de autenticación como `bcryptjs` y `jsonwebtoken`.

## Variables de entorno

Crear un archivo `.env` en la raíz del proyecto con una estructura similar a esta:

```env
PORT=3000
PGHOST=localhost
PGPORT=5432
PGDATABASE=conectaruraldb
PGUSER=conectaruraluser
PGPASSWORD=tu_password_aqui
JWTSECRET=tu_clave_jwt_aqui
NODE_ENV=development
```

La memoria indica que el backend usa un archivo `.env` para almacenar el puerto de escucha y los datos de conexión a PostgreSQL, así como la clave secreta utilizada para firmar los JWT.

## Scripts

En `package.json` se recomienda incluir al menos estos scripts:

```json
{
  "scripts": {
    "dev": "nodemon index.js",
    "start": "node index.js"
  }
}
```

Según la documentación del proyecto, `npm run dev` arranca el servidor en modo desarrollo con `nodemon`, mientras que `npm start` lo ejecuta de forma normal.

## Puesta en marcha

1. Asegurarse de que PostgreSQL está arrancado y que la base de datos del proyecto existe.
2. Configurar correctamente el archivo `.env`.
3. Iniciar el servidor:

```bash
npm run dev
```

Si todo está bien configurado, la API quedará escuchando en una dirección local similar a:

```bash
http://localhost:3000
```

La memoria incluye también rutas de comprobación inicial como `/health` para verificar que el servidor responde y `/test-db` para validar la conexión con PostgreSQL. 

## Funcionalidades principales

Este backend está diseñado para cubrir, al menos, los siguientes bloques funcionales:

- Registro e inicio de sesión de usuarias.
- Generación y validación de tokens JWT.
- Gestión de perfiles y control de acceso por rol.
- Consulta de cursos y detalle de módulos.
- Inscripciones, progreso y seguimiento del aprendizaje.
- Gestión de descargas para uso offline.
- Creación y seguimiento de incidencias de soporte.
- Asignación entre técnicas y usuarias.
- Estadísticas y resumen básico de actividad.

## Endpoints orientativos

Los nombres exactos pueden variar según la versión del proyecto, pero la memoria describe rutas asociadas a estos dominios funcionales:

| Área | Ejemplos de endpoints |
|------|------------------------|
| Salud del sistema | `GET /health`, `GET /test-db` |
| Autenticación | `POST /auth/register`, `POST /auth/login` |
| Cursos | `GET /cursos`, `GET /cursos/:id` |
| Perfil | `GET /perfil`, `PUT /perfil` |
| Progreso | `GET /progreso`, `POST /modulos/:id/progreso` |
| Descargas | `GET /descargas`, `POST /modulos/:id/descargas` |
| Incidencias | `POST /incidencias`, `GET /incidencias` |
| Asignaciones | `GET /asignaciones` |
| Estadísticas | `GET /stats/resumen` |

## Autenticación y seguridad

El sistema utiliza autenticación con JWT. Tras un login correcto, el servidor genera un token firmado que la aplicación cliente debe enviar en la cabecera `Authorization` con el formato `Bearer <token>` para acceder a rutas protegidas.

Las contraseñas no se almacenan en texto plano, sino hasheadas mediante `bcryptjs`, y las rutas privadas pueden protegerse mediante middlewares de autenticación y autorización por rol.

## Base de datos

La API se conecta a una base de datos PostgreSQL diseñada para gestionar entidades como roles, usuarios, cursos, módulos, inscripciones, progreso, descargas, incidencias y asignaciones entre técnicas y usuarias. 

La memoria también indica el uso de claves primarias, claves foráneas, restricciones `UNIQUE`, relaciones 1-N, tablas de soporte para progreso y descargas, e índices para optimizar consultas frecuentes.

## Pruebas

Para validar el backend de forma aislada, se recomienda utilizar Postman antes de integrarlo con la app Flutter o con la web de gestión.

Una secuencia mínima de prueba sería:

1. Comprobar `GET /health`.
2. Comprobar `GET /test-db`.
3. Registrar una usuaria con `POST /auth/register`.
4. Iniciar sesión con `POST /auth/login`.
5. Usar el token recibido para probar rutas protegidas.

## Git y buenas prácticas

Para publicar el proyecto en GitHub sin exponer información sensible, conviene incluir este `.gitignore`:

```gitignore
node_modules
.env
*.log
npm-debug.log*
.vscode
.idea
.DS_Store
Thumbs.db
```

No debe subirse nunca el archivo `.env`, ya que contiene credenciales de base de datos y la clave secreta de JWT.

## Estado del proyecto

Este repositorio documenta la primera versión funcional del backend de ConectaRural, alineada con los apartados de base de datos y backend desarrollados en la memoria del proyecto final.

## Autora

**Natalia Betancur y Natalia Reguilon**  
Proyecto Final de Ciclo — Sistemas de Telecomunicaciones e Informáticos.
