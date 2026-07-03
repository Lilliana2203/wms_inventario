const pool = require('./db');

async function main() {
  try {
    console.log('Resetting all passwords in `usuarios` table to "password123"...');
    const [result] = await pool.query("UPDATE `usuarios` SET `password` = SHA2('password123', 256)");
    console.log(`Success! Updated ${result.affectedRows} users.`);
  } catch (err) {
    console.error('Error updating passwords:', err);
  } finally {
    process.exit(0);
  }
}

main();
