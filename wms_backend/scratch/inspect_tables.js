const pool = require('../db');

async function main() {
  try {
    console.log('=== DESCRIBE historial_movimientos ===');
    const [hist] = await pool.query('DESCRIBE historial_movimientos');
    console.log(hist);
    
    console.log('\n=== DESCRIBE movimientos_inventario ===');
    const [mov] = await pool.query('DESCRIBE movimientos_inventario');
    console.log(mov);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

main();
