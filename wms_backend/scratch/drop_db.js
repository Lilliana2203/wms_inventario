const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../.env' });

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || ''
  });

  try {
    console.log('Dropping database wms_inventario...');
    await connection.query('DROP DATABASE IF EXISTS wms_inventario');
    console.log('Database dropped successfully!');
  } catch (err) {
    console.error('Error dropping database:', err);
  } finally {
    await connection.end();
  }
}

main();
