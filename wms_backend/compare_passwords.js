const crypto = require('crypto');

const target = '5c68fbfbf9711983beba73a2ad63ef5c06d42f12c9e3c02cf3e42d124f0072b1';

const variations = [
  'password123',
  'password123\n',
  'password123\r\n',
  'password123 ',
  ' password123',
  'password123!',
  'Password123!',
  'password123\0',
  'password123\t',
  'PASSWORD123',
  'password123'.toUpperCase(),
  'password123'.toLowerCase(),
  // Check common salts or double hashes
  crypto.createHash('sha256').update('password123').digest('hex'),
  crypto.createHash('sha256').update('password123\n').digest('hex'),
];

for (const val of variations) {
  const hash = crypto.createHash('sha256').update(val).digest('hex');
  if (hash === target) {
    console.log(`FOUND VARIATION: "${JSON.stringify(val)}"`);
    process.exit(0);
  }
}

console.log('No variation matched.');
