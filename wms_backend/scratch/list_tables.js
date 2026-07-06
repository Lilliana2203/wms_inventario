const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../.env' });

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'wms_inventario'
  });

  try {
    const [tables] = await connection.query('SHOW TABLES');
    console.log('Tables:', tables);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await connection.end();
  }
}

main();
