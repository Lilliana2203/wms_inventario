const crypto = require('crypto');
const mysql = require('mysql2/promise');

async function main() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'wms_inventario'
  });

  try {
    const [users] = await connection.query('SELECT id, nombre, email, password FROM `usuarios`');
    
    for (const user of users) {
      const firstName = user.nombre.split(' ')[0]; // e.g. Juan, Melisaa
      const userCandidates = [
        firstName + '123',
        firstName.toLowerCase() + '123',
        firstName + '1234',
        firstName + '2026',
        firstName + '!',
        firstName + '123!',
        firstName,
        firstName.toLowerCase()
      ];

      let found = false;
      for (const cand of userCandidates) {
        const hash = crypto.createHash('sha256').update(cand).digest('hex');
        if (hash === user.password) {
          console.log(`FOUND: "${user.email}" -> "${cand}"`);
          found = true;
          break;
        }
      }
      if (!found) {
        console.log(`Not found for: ${user.email}`);
      }
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await connection.end();
  }
}

main();
