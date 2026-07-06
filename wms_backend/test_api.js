const { spawn } = require('child_process');
const http = require('http');

const BASE_URL = 'http://localhost:3000/api/v1';

// Helper to make fetch requests in Node.js
function makeRequest(url, method, body = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsedData = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, body: parsedData });
        } catch (e) {
          resolve({ status: res.statusCode, rawBody: data });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('--- STARTING WMS BACKEND TEST SUITE ---');

  // Test users
  const users = {
    comprador: { id: 7, email: 'susanal@gmail.com', rol_id: 1 },
    alistador: { id: 4, email: 'manuelu@gmail.com', rol_id: 2 },
    montacarguista: { id: 3, email: 'michaels@gmail.com', rol_id: 3 },
    inventario: { id: 1, email: 'juanp@gmail.com', rol_id: 4 }
  };

  let passed = 0;
  let failed = 0;

  function assert(condition, message, extra = '') {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}. ${extra}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------
    // Test 1: AUTENTICACIÓN - Login exitoso
    // -------------------------------------------------------------
    console.log('\n--- Test 1: Autenticación - Login exitoso ---');
    const loginRes = await makeRequest(`${BASE_URL}/auth/login`, 'POST', {
      email: users.comprador.email,
      password: 'Password7*'
    });
    assert(loginRes.status === 200, 'Status should be 200 OK', `Got ${loginRes.status}`);
    assert(loginRes.body.success === true, 'Response success should be true');
    assert(loginRes.body.data && loginRes.body.data.user.rol_id === 1, 'User role_id should be 1');

    // -------------------------------------------------------------
    // Test 2: AUTENTICACIÓN - Login fallido (Credenciales incorrectas)
    // -------------------------------------------------------------
    console.log('\n--- Test 2: Autenticación - Login fallido ---');
    const loginFail = await makeRequest(`${BASE_URL}/auth/login`, 'POST', {
      email: users.comprador.email,
      password: 'wrongpassword'
    });
    assert(loginFail.status === 401, 'Status should be 401 Unauthorized for bad password', `Got ${loginFail.status}`);
    assert(loginFail.body.success === false, 'Response success should be false');

    // -------------------------------------------------------------
    // Test 3: CONSULTA - Mapa de racks
    // -------------------------------------------------------------
    console.log('\n--- Test 3: Consulta - Mapa de racks ---');
    const racksRes = await makeRequest(`${BASE_URL}/inventario/racks`, 'GET');
    assert(racksRes.status === 200, 'Status should be 200 OK', `Got ${racksRes.status}`);
    assert(Array.isArray(racksRes.body.data), 'Data should be an array');
    console.log(`Encontradas ${racksRes.body.data.length} posiciones en el mapa.`);

    // Check Martillo de Impacto (articulo_id = 5) positions
    const targetArticle = 'Martillo de Impacto Bosch Professional';
    const targetArtId = 5;

    const initialPositions = racksRes.body.data.filter(p => p.articulo === targetArticle);
    console.log(`Posiciones iniciales para '${targetArticle}':`);
    console.table(initialPositions);

    // -------------------------------------------------------------
    // Test 4: TRANSACCIONAL - Comprar (Comprador/Inventario)
    // -------------------------------------------------------------
    console.log(`\n--- Test 4: Comprar (${targetArticle}) ---`);
    // Test 4a: Permisos inválidos (Alistador no puede comprar)
    const compNoAuth = await makeRequest(`${BASE_URL}/inventario/comprar`, 'POST', {
      usuario_id: users.alistador.id,
      articulo_id: targetArtId,
      cantidad: 5
    });
    assert(compNoAuth.status === 401, 'Buying with invalid role (Alistador) should return 401', `Got ${compNoAuth.status}`);

    // Test 4b: Compra válida
    const compOk = await makeRequest(`${BASE_URL}/inventario/comprar`, 'POST', {
      usuario_id: users.comprador.id,
      articulo_id: targetArtId,
      cantidad: 5
    });
    assert(compOk.status === 200, 'Buying with Comprador role should return 200 OK', `Got ${compOk.status}: ${JSON.stringify(compOk.body)}`);
    if (compOk.status === 200) {
      assert(compOk.body.success === true, 'Response success should be true');
      console.log(`Pedido creado ID: ${compOk.body.data.pedido_id}`);
    }

    // Test 4c: Exceder existencias en Alisto
    const racksRes2 = await makeRequest(`${BASE_URL}/inventario/racks`, 'GET');
    const alistoPos = racksRes2.body.data.find(p => p.articulo === targetArticle && p.tipo_piso === 'Alisto');
    const currentAlistoQty = alistoPos ? alistoPos.cantidad_actual : 0;

    console.log(`Stock actual de ${targetArticle} en Alisto: ${currentAlistoQty}/20`);
    const compExceed = await makeRequest(`${BASE_URL}/inventario/comprar`, 'POST', {
      usuario_id: users.comprador.id,
      articulo_id: targetArtId,
      cantidad: currentAlistoQty + 1
    });
    assert(compExceed.status === 400, `Buying beyond available Alisto stock (${currentAlistoQty + 1} units) should return 400 Bad Request`, `Got ${compExceed.status}: ${JSON.stringify(compExceed.body)}`);

    // -------------------------------------------------------------
    // Test 5: TRANSACCIONAL - Reabastecer (Montacarguista/Inventario)
    // -------------------------------------------------------------
    console.log(`\n--- Test 5: Reabastecer (${targetArticle}) ---`);
    
    // Get target position ID from racks map
    const racksRes3 = await makeRequest(`${BASE_URL}/inventario/racks`, 'GET');
    const alistoPosPre = racksRes3.body.data.find(p => p.articulo === targetArticle && p.tipo_piso === 'Alisto');
    const targetPosId = alistoPosPre ? alistoPosPre.id : null;
    const alistoQtyPre = alistoPosPre ? alistoPosPre.cantidad_actual : 0;

    // Test 5a: Permisos inválidos (Alistador no puede reabastecer)
    const reabNoAuth = await makeRequest(`${BASE_URL}/inventario/reabastecer`, 'POST', {
      usuario_id: users.alistador.id,
      posicion_id: targetPosId,
      cantidad: 2
    });
    assert(reabNoAuth.status === 401, 'Replenishing with invalid role (Alistador) should return 401', `Got ${reabNoAuth.status}`);

    // Test 5b: Reabastecimiento válido
    // Create a pending task for Martillo de Impacto
    await makeRequest(`${BASE_URL}/inventario/solicitar-reabastecimiento`, 'POST', {
      usuario_id: users.inventario.id,
      articulo_id: targetArtId
    });

    const tasksResBefore = await makeRequest(`${BASE_URL}/inventario/tareas-pendientes`, 'GET');
    const hasTaskBefore = tasksResBefore.body.data.some(t => t.articulo_id === targetArtId && t.estado === 'Pendiente');
    assert(hasTaskBefore === true, 'Task should be registered as Pendiente');

    console.log(`Stock actual en Alisto antes del reabastecimiento: ${alistoQtyPre}/20`);

    const reabOk = await makeRequest(`${BASE_URL}/inventario/reabastecer`, 'POST', {
      usuario_id: users.montacarguista.id,
      posicion_id: targetPosId,
      cantidad: 2
    });
    assert(reabOk.status === 200, 'Replenishment should succeed with 200 OK', `Got ${reabOk.status}: ${JSON.stringify(reabOk.body)}`);
    if (reabOk.status === 200) {
      console.log(`Nuevo stock en Alisto: ${reabOk.body.data.alisto_actual}, Altura restante: ${reabOk.body.data.altura_restante}`);
    }

    // Verify task is now completed
    const tasksResAfter = await makeRequest(`${BASE_URL}/inventario/tareas-pendientes`, 'GET');
    const hasTaskAfter = tasksResAfter.body.data.some(t => t.articulo_id === targetArtId && t.estado === 'Pendiente');
    assert(hasTaskAfter === false, 'Task should be cleared/completed from pending tasks list');

    // Test 5c: Exceder capacidad de Alisto (max_alisto = 20)
    const racksRes4 = await makeRequest(`${BASE_URL}/inventario/racks`, 'GET');
    const alistoPosPost = racksRes4.body.data.find(p => p.id === targetPosId);
    const alistoQtyPost = alistoPosPost ? alistoPosPost.cantidad_actual : 0;
    const alistoCapacityLeft = 20 - alistoQtyPost;

    console.log(`Stock actual en Alisto: ${alistoQtyPost}/20. Capacidad libre: ${alistoCapacityLeft}`);
    const reabExceed = await makeRequest(`${BASE_URL}/inventario/reabastecer`, 'POST', {
      usuario_id: users.montacarguista.id,
      posicion_id: targetPosId,
      cantidad: alistoCapacityLeft + 1
    });
    assert(reabExceed.status === 400, `Replenishing beyond max_alisto (${alistoCapacityLeft + 1} units) should return 400`, `Got ${reabExceed.status}: ${JSON.stringify(reabExceed.body)}`);

    // Test 5d: Existencias insuficientes en Altura
    const reabNoStock = await makeRequest(`${BASE_URL}/inventario/reabastecer`, 'POST', {
      usuario_id: users.montacarguista.id,
      posicion_id: targetPosId,
      cantidad: 200
    });
    assert(reabNoStock.status === 400, 'Replenishing more than Altura stock should return 400', `Got ${reabNoStock.status}: ${JSON.stringify(reabNoStock.body)}`);

    // -------------------------------------------------------------
    // Test 6: TRANSACCIONAL - Despachar (Alistador/Inventario)
    // -------------------------------------------------------------
    console.log(`\n--- Test 6: Despachar (${targetArticle}) ---`);
    // Test 6a: Permisos inválidos (Montacarguista no puede despachar)
    const despNoAuth = await makeRequest(`${BASE_URL}/inventario/despachar`, 'POST', {
      usuario_id: users.montacarguista.id,
      articulo_id: targetArtId,
      cantidad: 1
    });
    assert(despNoAuth.status === 401, 'Dispatching with invalid role should return 401', `Got ${despNoAuth.status}`);

    // Test 6b: Despacho válido
    const despOk = await makeRequest(`${BASE_URL}/inventario/despachar`, 'POST', {
      usuario_id: users.alistador.id,
      articulo_id: targetArtId,
      cantidad: 2
    });
    assert(despOk.status === 200, 'Dispatching within limits should return 200 OK', `Got ${despOk.status}: ${JSON.stringify(despOk.body)}`);
    if (despOk.status === 200) {
      console.log(`Restante en Alisto: ${despOk.body.data.alisto_restante}`);
    }

    // Test 6c: Existencias insuficientes en Alisto
    const despNoStock = await makeRequest(`${BASE_URL}/inventario/despachar`, 'POST', {
      usuario_id: users.alistador.id,
      articulo_id: targetArtId,
      cantidad: 500
    });
    assert(despNoStock.status === 400, 'Dispatching more than Alisto stock should return 400', `Got ${despNoStock.status}: ${JSON.stringify(despNoStock.body)}`);

    // -------------------------------------------------------------
    // Test 7: TRANSACCIONAL - Ajuste por Daño (Solo Inventario)
    // -------------------------------------------------------------
    console.log(`\n--- Test 7: Ajuste por daño (${targetArticle}) ---`);
    // Test 7a: Permisos inválidos (Alistador no puede ajustar)
    const danoNoAuth = await makeRequest(`${BASE_URL}/inventario/ajuste-dano`, 'POST', {
      usuario_id: users.alistador.id,
      articulo_id: targetArtId,
      piso: 2,
      cantidad: 1
    });
    assert(danoNoAuth.status === 401, 'Damage adjusting with invalid role should return 401', `Got ${danoNoAuth.status}`);

    // Test 7b: Ajuste por daño válido
    const racksRes5 = await makeRequest(`${BASE_URL}/inventario/racks`, 'GET');
    const targetAlistoPiso = racksRes5.body.data.find(p => p.articulo === targetArticle && p.tipo_piso === 'Alisto');
    const targetPisoNum = targetAlistoPiso ? targetAlistoPiso.piso : 2;
    const qtyPreDano = targetAlistoPiso ? targetAlistoPiso.cantidad_actual : 0;
    console.log(`Stock actual en piso ${targetPisoNum} antes del ajuste por daño: ${qtyPreDano}`);

    const danoOk = await makeRequest(`${BASE_URL}/inventario/ajuste-dano`, 'POST', {
      usuario_id: users.inventario.id,
      articulo_id: targetArtId,
      piso: targetPisoNum,
      cantidad: 1
    });
    assert(danoOk.status === 200, 'Damage adjusting on valid position should return 200 OK', `Got ${danoOk.status}: ${JSON.stringify(danoOk.body)}`);
    if (danoOk.status === 200) {
      console.log(`Nueva cantidad en piso ${targetPisoNum}: ${danoOk.body.data.nueva_cantidad}`);
    }

    // Test 7c: Existencias insuficientes en el piso
    const danoNoStock = await makeRequest(`${BASE_URL}/inventario/ajuste-dano`, 'POST', {
      usuario_id: users.inventario.id,
      articulo_id: targetArtId,
      piso: targetPisoNum,
      cantidad: 1000
    });
    assert(danoNoStock.status === 400, 'Damage adjusting more than available stock should return 400', `Got ${danoNoStock.status}: ${JSON.stringify(danoNoStock.body)}`);

    console.log('\n--- FINAL STATUS MAP ---');
    const racksResFinal = await makeRequest(`${BASE_URL}/inventario/racks`, 'GET');
    const finalPositions = racksResFinal.body.data.filter(p => p.articulo === targetArticle);
    console.table(finalPositions);

    console.log('\n--- TEST RESULTS ---');
    console.log(`Passed: ${passed}/${passed + failed}`);
    console.log(`Failed: ${failed}/${passed + failed}`);

    return failed === 0;

  } catch (error) {
    console.error('Test Execution Failed:', error);
    return false;
  }
}

// Start server and run tests
const server = spawn('node', ['server.js'], { stdio: 'inherit' });

setTimeout(async () => {
  const success = await runTests();
  server.kill();
  process.exit(success ? 0 : 1);
}, 2000);
