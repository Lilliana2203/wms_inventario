const http = require('http');

function postJson(url, data) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const bodyStr = JSON.stringify(data);
    const req = http.request({
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    }).on('error', reject);
  });
}

async function test() {
  console.log('--- TESTING MOVIMIENTOS INVENTARIO ---');

  // 1. Check initial movements (GET)
  console.log('\n1. Fetching movements...');
  const initRes = await getJson('http://localhost:3000/api/v1/inventario/movimientos');
  console.log('Initial movements fetch status:', initRes.status);
  console.log('Initial movements count:', initRes.data?.data?.length);

  // 2. Perform Reabastecer (POST)
  console.log('\n2. Simulating reabastecer (moving 2 units of article 1 to position 32)...');
  const reabastRes = await postJson('http://localhost:3000/api/v1/inventario/reabastecer', {
    usuario_id: 1, // Juan Perez (Rol 4 - Inventario)
    posicion_id: 32, // Rack A Piso 1 (Alisto)
    cantidad: 2
  });
  console.log('Reabastecer status:', reabastRes.status);
  console.log('Reabastecer message:', reabastRes.data?.message);

  // 3. Perform Despachar (POST)
  console.log('\n3. Simulating despachar (SALIDA - dispatching 2 units of article 1)...');
  const despRes = await postJson('http://localhost:3000/api/v1/inventario/despachar', {
    usuario_id: 5, // Sandra Lopez (Rol 2 - Alistador)
    articulo_id: 1,
    cantidad: 2
  });
  console.log('Despachar status:', despRes.status);
  console.log('Despachar message:', despRes.data?.message);

  // 4. Check updated movements (GET)
  console.log('\n4. Fetching movements after transactions...');
  const finalRes = await getJson('http://localhost:3000/api/v1/inventario/movimientos');
  console.log('Final movements fetch status:', finalRes.status);
  console.log('Final movements:');
  console.dir(finalRes.data?.data, { depth: null });
}

test().catch(console.error);
