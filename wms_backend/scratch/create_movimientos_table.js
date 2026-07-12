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
    console.log('Creating table movimientos_inventario...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`movimientos_inventario\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`articulo_id\` int(11) NOT NULL,
        \`usuario_id\` int(11) NOT NULL,
        \`tipo_movimiento\` enum('ENTRADA','SALIDA','REABASTECIMIENTO','AJUSTE') NOT NULL,
        \`cantidad\` int(11) NOT NULL,
        \`posicion_origen\` varchar(50) DEFAULT NULL,
        \`posicion_destino\` varchar(50) DEFAULT NULL,
        \`fecha\` timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (\`id\`),
        KEY \`articulo_id\` (\`articulo_id\`),
        KEY \`usuario_id\` (\`usuario_id\`),
        CONSTRAINT \`movimientos_inventario_ibfk_1\` FOREIGN KEY (\`articulo_id\`) REFERENCES \`articulos\` (\`id\`),
        CONSTRAINT \`movimientos_inventario_ibfk_2\` FOREIGN KEY (\`usuario_id\`) REFERENCES \`usuarios\` (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);
    console.log('Table movimientos_inventario created successfully!');
  } catch (err) {
    console.error('Error creating table movimientos_inventario:', err);
  } finally {
    await connection.end();
  }
}

main();
