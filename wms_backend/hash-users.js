const bcrypt = require('bcryptjs');
const pool = require('./db');

const usuarios = [
  { id: 1, nombre: 'Juan Perez', email: 'juanp@gmail.com', pass: 'Password1*', rol: 4 },
  { id: 2, nombre: 'Melisaa Porras', email: 'melissap@gmail.com', pass: 'Password2*', rol: 4 },
  { id: 3, nombre: 'Michael Salas', email: 'michaels@gmail.com', pass: 'Password3*', rol: 3 },
  { id: 4, nombre: 'Manuel Ugarte', email: 'manuelu@gmail.com', pass: 'Password4*', rol: 2 },
  { id: 5, nombre: 'Sandra Lopez', email: 'sandral@gmail.com', pass: 'Password5*', rol: 2 },
  { id: 6, nombre: 'Jordan Carvajal', email: 'jordanc@gmail.com', pass: 'Password6*', rol: 2 },
  { id: 7, nombre: 'Susana Lopez', email: 'susanal@gmail.com', pass: 'Password7*', rol: 1 },
  { id: 8, nombre: 'Fanny Quesada', email: 'fannyq@gmail.com', pass: 'Password8*', rol: 1 },
  { id: 9, nombre: 'Hector Madrigal', email: 'hectorm@gmail.com', pass: 'Password9*', rol: 1 },
  { id: 10, nombre: 'Marco Ulate', email: 'marcou@gmail.com', pass: 'Password10*', rol: 1 },
  { id: 11, nombre: 'Prueba Cliente', email: 'pruebac@gmail.com', pass: 'Password11*', rol: 1 },
  { id: 12, nombre: 'Erick Petro', email: 'erickp@gmail.com', pass: 'Password12*', rol: 5 }
];

async function main() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    console.log('Disabling foreign key checks...');
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    
    console.log('Cleaning table usuarios...');
    await connection.query('DELETE FROM usuarios');
    
    console.log('Hashing passwords and inserting users...');
    for (const u of usuarios) {
      const hash = await bcrypt.hash(u.pass, 10);
      await connection.query(
        'INSERT INTO usuarios (id, nombre, email, password, rol_id, activo) VALUES (?, ?, ?, ?, ?, 1)',
        [u.id, u.nombre, u.email, hash, u.rol]
      );
      console.log(`Inserted: ${u.nombre} (${u.email})`);
    }
    
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    await connection.commit();
    console.log('Database users successfully updated with Bcrypt hashes!');
  } catch (err) {
    await connection.rollback();
    console.error('Error updating users:', err);
  } finally {
    connection.release();
    process.exit(0);
  }
}

main();
