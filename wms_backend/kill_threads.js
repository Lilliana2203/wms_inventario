const pool = require('./db');

async function main() {
  try {
    console.log('Killing thread 36...');
    await pool.query('KILL 36').catch(e => console.log('Thread 36 kill err:', e.message));
    
    console.log('Killing thread 37...');
    await pool.query('KILL 37').catch(e => console.log('Thread 37 kill err:', e.message));
    
    console.log('Threads killed!');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

main();
