const pool = require('../db');

async function main() {
  try {
    await pool.query('UPDATE usuarios SET activo = 1');
    console.log('Set all users to active = 1');
    const [rows] = await pool.query('SELECT id, nombre, email, password, rol_id, activo FROM usuarios');
    console.log(rows);
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}
main();
