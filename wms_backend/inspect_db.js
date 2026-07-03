const pool = require('./db');

async function main() {
  try {
    console.log('=== USUARIOS ===');
    const [users] = await pool.query('SELECT id, nombre, email, password, rol_id FROM usuarios');
    console.log(users);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

main();
