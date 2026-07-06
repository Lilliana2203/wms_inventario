const bcrypt = require('bcryptjs');

const users = [
  { id: 1, nombre: 'Juan Perez', email: 'juanp@gmail.com', password: 'Password1*', rol: 4 },
  { id: 2, nombre: 'Melisaa Porras', email: 'melissap@gmail.com', password: 'Password2*', rol: 4 },
  { id: 3, nombre: 'Michael Salas', email: 'michaels@gmail.com', password: 'Password3*', rol: 3 },
  { id: 4, nombre: 'Manuel Ugarte', email: 'manuelu@gmail.com', password: 'Password4*', rol: 2 },
  { id: 5, nombre: 'Sandra Lopez', email: 'sandral@gmail.com', password: 'Password5*', rol: 2 },
  { id: 6, nombre: 'Jordan Carvajal', email: 'jordanc@gmail.com', password: 'Password6*', rol: 2 },
  { id: 7, nombre: 'Susana Lopez', email: 'susanal@gmail.com', password: 'Password7*', rol: 1 },
  { id: 8, nombre: 'Fanny Quesada', email: 'fannyq@gmail.com', password: 'Password8*', rol: 1 },
  { id: 9, nombre: 'Hector Madrigal', email: 'hectorm@gmail.com', password: 'Password9*', rol: 1 },
  { id: 10, nombre: 'Marco Ulate', email: 'marcou@gmail.com', password: 'Password10*', rol: 1 },
  { id: 11, nombre: 'Prueba Cliente', email: 'pruebac@gmail.com', password: 'Password11*', rol: 1 },
  { id: 17, nombre: 'Erick Petro', email: 'erickp@gmail.com', password: 'Password12*', rol: 5 }
];

async function main() {
  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 10);
    console.log(`INSERT INTO \`usuarios\` (\`id\`, \`nombre\`, \`email\`, \`password\`, \`rol_id\`) VALUES (${u.id}, '${u.nombre}', '${u.email}', '${hash}', ${u.rol});`);
  }
}

main();
