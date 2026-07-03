const pool = require('./db');

async function main() {
  try {
    console.log('Inserting a pending task for Caladoras (articulo_id = 8) requested by Juan Perez (id = 1)...');
    
    // First, clear any existing pending tasks for Caladoras to start clean
    await pool.query(
      "DELETE FROM tareas_pendientes WHERE articulo_id = 8"
    );

    // Insert a new pending task
    await pool.query(
      "INSERT INTO tareas_pendientes (articulo_id, solicitado_por, estado) VALUES (8, 1, 'Pendiente')"
    );

    console.log('Task inserted successfully!');
  } catch (err) {
    console.error('Error inserting task:', err);
  } finally {
    process.exit(0);
  }
}

main();
