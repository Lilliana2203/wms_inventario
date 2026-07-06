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
    console.log('Creating table tareas_pendientes...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`tareas_pendientes\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`articulo_id\` int(11) NOT NULL,
        \`solicitado_por\` int(11) NOT NULL,
        \`estado\` varchar(50) DEFAULT 'Pendiente',
        \`fecha_creacion\` timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (\`id\`),
        KEY \`articulo_id\` (\`articulo_id\`),
        KEY \`solicitado_por\` (\`solicitado_por\`),
        CONSTRAINT \`tareas_pendientes_ibfk_1\` FOREIGN KEY (\`articulo_id\`) REFERENCES \`articulos\` (\`id\`),
        CONSTRAINT \`tareas_pendientes_ibfk_2\` FOREIGN KEY (\`solicitado_por\`) REFERENCES \`usuarios\` (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    console.log('Creating table solicitudes_reabastecimiento...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`solicitudes_reabastecimiento\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`articulo_id\` int(11) NOT NULL,
        \`solicitado_por\` int(11) NOT NULL,
        \`estado\` varchar(50) DEFAULT 'PENDIENTE_INVENTARIO',
        \`fecha_creacion\` timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (\`id\`),
        KEY \`articulo_id\` (\`articulo_id\`),
        KEY \`solicitado_por\` (\`solicitado_por\`),
        CONSTRAINT \`solicitudes_reabastecimiento_ibfk_1\` FOREIGN KEY (\`articulo_id\`) REFERENCES \`articulos\` (\`id\`),
        CONSTRAINT \`solicitudes_reabastecimiento_ibfk_2\` FOREIGN KEY (\`solicitado_por\`) REFERENCES \`usuarios\` (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    console.log('Remaining tables created successfully!');
  } catch (err) {
    console.error('Error creating tables:', err);
  } finally {
    await connection.end();
  }
}

main();
