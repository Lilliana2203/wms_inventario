const pool = require('../db');

async function main() {
  try {
    console.log('=== SHOW TRIGGERS ===');
    const [triggers] = await pool.query('SHOW TRIGGERS');
    console.log(triggers);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

main();
