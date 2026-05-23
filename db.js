// db.js

// Importa Pool desde pg (cliente oficial de PostgreSQL para Node.js)
const { Pool } = require('pg');
const dotenv = require('dotenv');

// Carga las variables de entorno desde el archivo .env
dotenv.config();

// Crea un pool de conexiones a PostgreSQL usando los datos de .env
const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
});
  
pool.on('error', (err) => {
  console.error('Error inesperado en el pool de PostgreSQL:', err);
  process.exit(1);
});

// Función auxiliar para ejecutar consultas SQL
const query = (text, params) => {
  return pool.query(text, params);
};

// Exporta el pool y la función query para usarlos en otros archivos
module.exports = { pool, query };