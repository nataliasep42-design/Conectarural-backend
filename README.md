# ConectaRural Backend

Backend API de **ConectaRural**, desarrollado con Node.js, Express y PostgreSQL como capa intermedia entre la aplicación móvil, la web de gestión y la base de datos del proyecto. [file:2]

## Descripción

Este backend centraliza la lógica de negocio del sistema y gestiona funcionalidades como autenticación, usuarios y roles, cursos y módulos, progreso, descargas, incidencias, asignaciones entre técnicas y usuarias, y estadísticas básicas. [file:2]

La API sigue una arquitectura modular y está pensada para servir como punto de unión entre las interfaces cliente y PostgreSQL, evitando el acceso directo a la base de datos desde la app Flutter o futuras interfaces web. [file:2]

## Tecnologías utilizadas

- Node.js. [file:2]
- Express. [file:2]
- PostgreSQL. [file:2]
- `pg` para la conexión con la base de datos. [file:2]
- `dotenv` para variables de entorno. [file:2]
- `cors` para permitir peticiones desde clientes externos durante el desarrollo. [file:2]
- `bcryptjs` para el hash de contraseñas. [file:2]
- `jsonwebtoken` para autenticación basada en JWT. [file:2]
- `nodemon` para ejecución en desarrollo con reinicio automático. [file:2]

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

La memoria del proyecto describe una versión final del backend organizada en torno a un archivo de arranque (`index.js`), un módulo de conexión con PostgreSQL (`db.js`), middlewares de autenticación y autorización por rol, y rutas agrupadas por dominio funcional. [file:2]

## Requisitos previos

Antes de ejecutar el proyecto, es necesario tener instalado lo siguiente:

- Node.js y npm. [file:2]
- PostgreSQL. [file:2]
- Un editor como Visual Studio Code y, opcionalmente, Postman para probar endpoints. [file:2]

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

La configuración base descrita en la memoria parte de `npm init -y` y de la instalación de `express`, `pg`, `cors`, `dotenv` y `nodemon`, ampliándose después con librerías de autenticación como `bcryptjs` y `jsonwebtoken`. [file:2]

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

La memoria indica que el backend usa un archivo `.env` para almacenar el puerto de escucha y los datos de conexión a PostgreSQL, así como la clave secreta utilizada para firmar los JWT. [file:2]

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

Según la documentación del proyecto, `npm run dev` arranca el servidor en modo desarrollo con `nodemon`, mientras que `npm start` lo ejecuta de forma normal. [file:2]

## Puesta en marcha

1. Asegurarse de que PostgreSQL está arrancado y que la base de datos del proyecto existe. [file:2]
2. Configurar correctamente el archivo `.env`. [file:2]
3. Iniciar el servidor:

```bash
npm run dev
```

Si todo está bien configurado, la API quedará escuchando en una dirección local similar a:

```bash
http://localhost:3000
```

La memoria incluye también rutas de comprobación inicial como `/health` para verificar que el servidor responde y `/test-db` para validar la conexión con PostgreSQL. [file:2]

## Funcionalidades principales

Este backend está diseñado para cubrir, al menos, los siguientes bloques funcionales:

- Registro e inicio de sesión de usuarias. [file:2]
- Generación y validación de tokens JWT. [file:2]
- Gestión de perfiles y control de acceso por rol. [file:2]
- Consulta de cursos y detalle de módulos. [file:2]
- Inscripciones, progreso y seguimiento del aprendizaje. [file:2]
- Gestión de descargas para uso offline. [file:2]
- Creación y seguimiento de incidencias de soporte. [file:2]
- Asignación entre técnicas y usuarias. [file:2]
- Estadísticas y resumen básico de actividad. [file:2]

## Endpoints orientativos

Los nombres exactos pueden variar según la versión del proyecto, pero la memoria describe rutas asociadas a estos dominios funcionales: [file:2]

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

El sistema utiliza autenticación con JWT. Tras un login correcto, el servidor genera un token firmado que la aplicación cliente debe enviar en la cabecera `Authorization` con el formato `Bearer <token>` para acceder a rutas protegidas. [file:2]

Las contraseñas no se almacenan en texto plano, sino hasheadas mediante `bcryptjs`, y las rutas privadas pueden protegerse mediante middlewares de autenticación y autorización por rol. [file:2]

## Base de datos

La API se conecta a una base de datos PostgreSQL diseñada para gestionar entidades como roles, usuarios, cursos, módulos, inscripciones, progreso, descargas, incidencias y asignaciones entre técnicas y usuarias. [file:2]

La memoria también indica el uso de claves primarias, claves foráneas, restricciones `UNIQUE`, relaciones 1-N, tablas de soporte para progreso y descargas, e índices para optimizar consultas frecuentes. [file:2]

## Pruebas

Para validar el backend de forma aislada, se recomienda utilizar Postman antes de integrarlo con la app Flutter o con la web de gestión. [file:2]

Una secuencia mínima de prueba sería:

1. Comprobar `GET /health`. [file:2]
2. Comprobar `GET /test-db`. [file:2]
3. Registrar una usuaria con `POST /auth/register`. [file:2]
4. Iniciar sesión con `POST /auth/login`. [file:2]
5. Usar el token recibido para probar rutas protegidas. [file:2]

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

No debe subirse nunca el archivo `.env`, ya que contiene credenciales de base de datos y la clave secreta de JWT. [file:2]

## Estado del proyecto

Este repositorio documenta la primera versión funcional del backend de ConectaRural, alineada con los apartados de base de datos y backend desarrollados en la memoria del proyecto final. [file:2]

## Autora

**Natalia Betancur y Natalia Reguilon**  
Proyecto Final de Ciclo — Sistemas de Telecomunicaciones e Informáticos.
