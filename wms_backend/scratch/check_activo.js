const pool = require('../db');

async function main() {
  const [rows] = await pool.query('SELECT email, activo FROM usuarios WHERE email = "pruebac@gmail.com"');
  console.log(rows);
  process.exit(0);
}
main();
