const pool = require('./db');

async function main() {
  try {
    console.log('Resetting stock positions for Martillo de Impacto (articulo_id = 5) and Caladoras (articulo_id = 8)...');
    
    // Martillo de Impacto (5)
    await pool.query(
      "UPDATE posiciones_rack SET cantidad_actual = 10 WHERE articulo_id = 5 AND tipo = 'Alisto'"
    );
    await pool.query(
      "UPDATE posiciones_rack SET cantidad_actual = 55 WHERE articulo_id = 5 AND tipo = 'Altura'"
    );

    // Caladoras (8)
    await pool.query(
      "UPDATE posiciones_rack SET cantidad_actual = 0 WHERE articulo_id = 8 AND tipo = 'Alisto'"
    );
    await pool.query(
      "UPDATE posiciones_rack SET cantidad_actual = 20 WHERE articulo_id = 8 AND tipo = 'Altura'"
    );

    console.log('Reset completed successfully!');
  } catch (err) {
    console.error('Error resetting database stock:', err);
  } finally {
    process.exit(0);
  }
}

main();
