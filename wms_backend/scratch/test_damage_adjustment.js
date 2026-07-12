const pool = require('../db');
const http = require('http');

function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let rawData = '';
      res.on('data', (chunk) => { rawData += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(rawData) });
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let rawData = '';
      res.on('data', (chunk) => { rawData += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(rawData) });
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  try {
    // 1. Get an Inventario user (rol_id = 4)
    const [users] = await pool.query('SELECT id, nombre, email FROM usuarios WHERE rol_id = 4 LIMIT 1');
    if (users.length === 0) {
      throw new Error('No user with rol_id = 4 found in database');
    }
    const user = users[0];
    console.log(`Using Inventario User: ID=${user.id}, Nombre=${user.nombre}, Email=${user.email}`);

    // 2. Get an active rack position with quantity > 0
    const [positions] = await pool.query('SELECT articulo_id, piso, cantidad_actual FROM posiciones_rack WHERE cantidad_actual > 0 LIMIT 1');
    if (positions.length === 0) {
      throw new Error('No rack positions with positive inventory found');
    }
    const pos = positions[0];
    console.log(`Using Rack Position: ArticuloID=${pos.articulo_id}, Piso=${pos.piso}, Stock=${pos.cantidad_actual}`);

    // 3. Test validation - POST /api/v1/inventario/ajuste-dano with empty/missing damage detail
    console.log('\n--- Testing Validation (Missing detail) ---');
    const res1 = await postJson('http://localhost:3000/api/v1/inventario/ajuste-dano', {
      usuario_id: user.id,
      articulo_id: pos.articulo_id,
      piso: pos.piso,
      cantidad: 1
      // detalle_dano missing
    });
    console.log('Status Code:', res1.status);
    console.log('Response:', res1.body);
    
    if (res1.status !== 400 || res1.body.message !== 'Es obligatorio detallar el motivo por el cual la mercadería se reporta como dañada') {
      throw new Error('Validation for missing detalle_dano failed!');
    }

    console.log('\n--- Testing Validation (Empty detail) ---');
    const res2 = await postJson('http://localhost:3000/api/v1/inventario/ajuste-dano', {
      usuario_id: user.id,
      articulo_id: pos.articulo_id,
      piso: pos.piso,
      cantidad: 1,
      detalle_dano: '   '
    });
    console.log('Status Code:', res2.status);
    console.log('Response:', res2.body);

    if (res2.status !== 400 || res2.body.message !== 'Es obligatorio detallar el motivo por el cual la mercadería se reporta como dañada') {
      throw new Error('Validation for empty/whitespace detalle_dano failed!');
    }

    // 4. Test success - POST /api/v1/inventario/ajuste-dano with detail
    console.log('\n--- Testing Success (Valid detail) ---');
    const uniqueReason = 'Test: Caja dañada por montacargas - ' + Date.now();
    const res3 = await postJson('http://localhost:3000/api/v1/inventario/ajuste-dano', {
      usuario_id: user.id,
      articulo_id: pos.articulo_id,
      piso: pos.piso,
      cantidad: 1,
      detalle_dano: uniqueReason
    });
    console.log('Status Code:', res3.status);
    console.log('Response:', res3.body);

    if (res3.status !== 200 || !res3.body.success) {
      throw new Error('Damage adjustment submission failed!');
    }

    // 5. Test history - GET /api/v1/inventario/movimientos
    console.log('\n--- Testing Movements History ---');
    const res4 = await getJson('http://localhost:3000/api/v1/inventario/movimientos');
    console.log('Status Code:', res4.status);
    
    const matchingMovement = res4.body.data.find(mov => mov.detalle_dano === uniqueReason);
    if (!matchingMovement) {
      throw new Error('Could not find the logged adjustment movement in history, or detalle_dano is missing!');
    }
    console.log('Found matching movement in history:', matchingMovement);
    console.log('\nSUCCESS! ALL TESTS PASSED!');

  } catch (err) {
    console.error('Error during testing:', err.message);
  } finally {
    process.exit(0);
  }
}

main();
