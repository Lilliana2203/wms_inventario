const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  });

  try {
    const schemaPath = 'c:\\Users\\andra\\OneDrive\\Documents\\UCEM\\VI Cuatrimestre\\Cuarta IV Gen I\\Proyecto Inventarios\\schema.sql';
    const sql = fs.readFileSync(schemaPath, 'utf8');

    // Split SQL by semicolon, but clean up comments and empty statements.
    const statements = sql
      .split(';')
      .map(s => {
        // Remove comments starting with --
        let cleaned = s.replace(/--.*$/gm, '');
        // Remove comments starting with /* ... */
        cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
        return cleaned.trim();
      })
      .filter(s => s.length > 0);

    console.log(`Found ${statements.length} SQL statements to execute.`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`Executing statement ${i + 1}/${statements.length}...`);
      try {
        await connection.query(statement);
      } catch (err) {
        console.error(`Error executing statement ${i + 1}:`);
        console.error(statement);
        console.error(err);
        throw err;
      }
    }

    console.log('Database schema and seeds successfully imported!');
  } catch (err) {
    console.error('Fatal error during import:', err.message);
  } finally {
    await connection.end();
  }
}

run();
