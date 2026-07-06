const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../.env' });

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'wms_inventario'
  });

  try {
    console.log('Creating view vista_mapa_racks...');
    await connection.query(`
      CREATE OR REPLACE VIEW vista_mapa_racks AS
      SELECT 
        pr.id,
        pr.rack_nombre,
        pr.piso,
        pr.tipo AS tipo_piso,
        a.nombre AS articulo,
        pr.cantidad_actual,
        CASE 
          WHEN pr.tipo = 'Alisto' THEN a.max_alisto
          ELSE a.max_altura
        END AS capacidad_maxima
      FROM posiciones_rack pr
      LEFT JOIN articulos a ON pr.articulo_id = a.id;
    `);
    console.log('View created successfully!');
  } catch (err) {
    console.error('Error creating view:', err);
  } finally {
    await connection.end();
  }
}

main();
