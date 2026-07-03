const pool = require('../db');

async function main() {
  try {
    const [rows] = await pool.query('SELECT id, nombre, email, password, rol_id FROM usuarios');
    console.log('--- USERS IN DATABASE ---');
    rows.forEach(u => {
      console.log(`ID: ${u.id} | Nombre: ${u.nombre} | Email: ${u.email} | Hash: ${u.password} | Rol: ${u.rol_id}`);
    });
  } catch (err) {
    console.error('Error fetching users:', err);
  } finally {
    process.exit(0);
  }
}

main();
