const pool = require('./db');
const bcrypt = require('bcryptjs');

async function main() {
  try {
    console.log('Resetting all passwords in `usuarios` table to "password123"...');
    const hashedPassword = await bcrypt.hash('password123', 10);
    const [result] = await pool.query("UPDATE `usuarios` SET `password` = ?", [hashedPassword]);
    console.log(`Success! Updated ${result.affectedRows} users.`);
  } catch (err) {
    console.error('Error updating passwords:', err);
  } finally {
    process.exit(0);
  }
}

main();
