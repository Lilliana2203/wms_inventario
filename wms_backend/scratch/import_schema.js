const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
  });

  try {
    console.log('Reading schema.sql...');
    const schemaPath = 'c:\\Users\\andra\\OneDrive\\Documents\\UCEM\\VI Cuatrimestre\\Cuarta IV Gen I\\Proyecto Inventarios\\schema.sql';
    const sql = fs.readFileSync(schemaPath, 'utf8');

    console.log('Executing schema.sql...');
    await connection.query(sql);
    console.log('Database schema and seeds successfully imported!');
  } catch (err) {
    console.error('Error importing schema:', err);
  } finally {
    await connection.end();
  }
}

run();
