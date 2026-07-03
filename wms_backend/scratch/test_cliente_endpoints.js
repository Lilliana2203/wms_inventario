const pool = require('../db');

async function test() {
  try {
    console.log('=== RUNNING TESTS ===');

    // 1. Find a customer in the DB
    const [users] = await pool.query('SELECT id, nombre FROM usuarios WHERE rol_id = 1 AND activo = 1 LIMIT 1');
    if (users.length === 0) {
      console.log('No active client found in DB. Test cannot proceed.');
      process.exit(1);
    }
    const client = users[0];
    console.log(`Using client: ID=${client.id}, Name="${client.nombre}"`);

    // 2. Find an article in DB with some stock in Alisto
    const [articles] = await pool.query(`
      SELECT a.id, a.nombre, a.precio_base, SUM(pr.cantidad_actual) as stock
      FROM articulos a
      JOIN posiciones_rack pr ON a.id = pr.articulo_id
      WHERE pr.tipo = 'Alisto' AND pr.piso IN (1, 2, 3)
      GROUP BY a.id, a.nombre, a.precio_base
      HAVING stock > 2
      LIMIT 1
    `);
    if (articles.length === 0) {
      console.log('No articles with Alisto stock > 2 found. Test cannot proceed.');
      process.exit(1);
    }
    const article = articles[0];
    console.log(`Using article: ID=${article.id}, Name="${article.nombre}", Price=${article.precio_base}, Current Stock=${article.stock}`);

    const qtyToOrder = 2;
    const expectedSubtotal = parseFloat(article.precio_base) * qtyToOrder;
    const expectedImpuesto = expectedSubtotal * 0.13;
    const expectedTotal = expectedSubtotal + expectedImpuesto;

    console.log(`Expected Subtotal: ${expectedSubtotal}, Expected Tax: ${expectedImpuesto}, Expected Total: ${expectedTotal}`);

    // 3. Call the API to create the order
    console.log('\nSending POST request to /api/v1/inventario/crear-pedido...');
    const response = await fetch('http://localhost:3000/api/v1/inventario/crear-pedido', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cliente_id: client.id,
        productos: [{ id: article.id, cantidad: qtyToOrder }],
        tipo_entrega: 'express',
        telefono_contacto: '8888-9999',
        direccion_envio: 'San Jose, Costa Rica'
      })
    });

    const result = await response.json();
    console.log('API Response:', JSON.stringify(result, null, 2));

    if (!result.success) {
      console.error('Order creation failed!');
      process.exit(1);
    }

    const newOrderId = result.pedido_id;
    console.log(`\nOrder created successfully! Order ID = ${newOrderId}`);

    // 4. Verify stock decrement
    const [updatedStockRows] = await pool.query(`
      SELECT SUM(pr.cantidad_actual) as stock
      FROM posiciones_rack pr
      WHERE pr.articulo_id = ? AND pr.tipo = 'Alisto' AND pr.piso IN (1, 2, 3)
    `, [article.id]);
    const newStock = updatedStockRows[0].stock;
    console.log(`New Stock after deduction: ${newStock}`);

    const expectedNewStock = article.stock - qtyToOrder;
    if (Number(newStock) !== Number(expectedNewStock)) {
      console.error(`Stock mismatch! Expected ${expectedNewStock}, but got ${newStock}`);
      process.exit(1);
    }
    console.log('Stock decremented correctly!');

    // 5. Check order history
    console.log('\nSending GET request to /api/v1/inventario/historial-cliente...');
    const historyRes = await fetch(`http://localhost:3000/api/v1/inventario/historial-cliente?cliente_id=${client.id}`);
    const historyResult = await historyRes.json();
    
    if (!historyResult.success) {
      console.error('Fetching history failed!');
      process.exit(1);
    }

    const createdOrder = historyResult.data.find(o => o.id === newOrderId);
    if (!createdOrder) {
      console.error(`Order #${newOrderId} not found in client history!`);
      process.exit(1);
    }

    console.log(`Order #${newOrderId} found in history!`);
    console.log('Order Details in History:', JSON.stringify(createdOrder, null, 2));

    console.log('\n=== ALL TESTS PASSED SUCCESSFULLY! ===');
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    try {
      await pool.end();
    } catch (e) {
      console.error('Error closing pool:', e);
    }
    process.exit(0);
  }
}

test();
