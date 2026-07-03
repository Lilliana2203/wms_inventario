const pool = require('./db');

async function main() {
  try {
    console.log('=== ACTIVE TRANSACTIONS ===');
    const [trx] = await pool.query('SELECT * FROM information_schema.innodb_trx');
    console.log(trx);

    console.log('\n=== PROCESS LIST ===');
    const [proc] = await pool.query('SHOW PROCESSLIST');
    console.log(proc);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

main();
