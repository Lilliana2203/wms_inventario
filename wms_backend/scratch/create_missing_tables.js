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
    console.log('Creating table pedido_items...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`pedido_items\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`pedido_id\` int(11) NOT NULL,
        \`articulo_id\` int(11) NOT NULL,
        \`cantidad\` int(11) NOT NULL,
        PRIMARY KEY (\`id\`),
        KEY \`pedido_id\` (\`pedido_id\`),
        KEY \`articulo_id\` (\`articulo_id\`),
        CONSTRAINT \`pedido_items_ibfk_1\` FOREIGN KEY (\`pedido_id\`) REFERENCES \`pedidos\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`pedido_items_ibfk_2\` FOREIGN KEY (\`articulo_id\`) REFERENCES \`articulos\` (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    console.log('Creating table historial_movimientos...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`historial_movimientos\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`usuario_id\` int(11) NOT NULL,
        \`cliente_id\` int(11) DEFAULT NULL,
        \`articulo_id\` int(11) NOT NULL,
        \`tipo_movimiento\` varchar(50) NOT NULL,
        \`cantidad\` int(11) NOT NULL,
        \`fecha\` timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (\`id\`),
        KEY \`usuario_id\` (\`usuario_id\`),
        KEY \`cliente_id\` (\`cliente_id\`),
        KEY \`articulo_id\` (\`articulo_id\`),
        CONSTRAINT \`historial_movimientos_ibfk_1\` FOREIGN KEY (\`usuario_id\`) REFERENCES \`usuarios\` (\`id\`),
        CONSTRAINT \`historial_movimientos_ibfk_2\` FOREIGN KEY (\`cliente_id\`) REFERENCES \`usuarios\` (\`id\`),
        CONSTRAINT \`historial_movimientos_ibfk_3\` FOREIGN KEY (\`articulo_id\`) REFERENCES \`articulos\` (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    console.log('Tables created successfully!');
  } catch (err) {
    console.error('Error creating tables:', err);
  } finally {
    await connection.end();
  }
}

main();
