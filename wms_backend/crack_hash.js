const crypto = require('crypto');

const target = '5c68fbfbf9711983beba73a2ad63ef5c06d42f12c9e3c02cf3e42d124f0072b1';

const common = [
  'password123', 'Password123', 'password', 'Password', '123456', 'admin', 'admin123',
  'michaels', 'salas', 'michaelsalas', 'juanp', 'susanal', 'inventario', 'wms', 'wms123',
  'michaels123', 'salas123', 'salaspassword', 'salast123', 'michaelsalas123',
  'juanperez', 'juanp123', 'juanperez123', 'susanalopez', 'susanal123', 'susanalopez123',
  'cladoras', 'caladoras', 'martillo', 'martillodeimpacto', 'compras', 'alistador',
  'montacargas', 'montacarguista', 'supervisor', 'juan', 'susana', 'michael',
  'password123!', 'Password123!', 'password!', '12345678', '123456789'
];

for (const word of common) {
  const hash = crypto.createHash('sha256').update(word).digest('hex');
  if (hash === target) {
    console.log(`FOUND! The word is: "${word}"`);
    process.exit(0);
  }
}

console.log('Not found in common list.');
