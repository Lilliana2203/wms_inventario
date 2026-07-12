const pool = require('../db');
const bcrypt = require('bcryptjs');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');

// Helper to verify user existence and role
async function verifyUserRole(connection, usuario_id, allowedRoles) {
  if (!usuario_id) {
    const err = new Error('ID de usuario no proporcionado');
    err.statusCode = 401;
    throw err;
  }

  const [users] = await connection.query(
    'SELECT rol_id FROM usuarios WHERE id = ?',
    [usuario_id]
  );

  if (users.length === 0) {
    const err = new Error('Usuario no encontrado');
    err.statusCode = 401;
    throw err;
  }

  const userRol = users[0].rol_id;
  if (!allowedRoles.includes(userRol)) {
    const err = new Error('Acceso no autorizado para este rol');
    err.statusCode = 401;
    throw err;
  }

  return userRol;
}

// Helper to generate PDF Invoice Buffer
const generatePDFBuffer = (order, items) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });
      doc.on('error', (err) => reject(err));

      const formatColones = (num) => `₡${parseFloat(num || 0).toLocaleString('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

      // Header
      doc.fillColor('#1C2541').rect(0, 0, 612, 100).fill();
      doc.fillColor('#FFFFFF')
         .fontSize(22)
         .text('WMS INVENTARIO', 50, 30, { align: 'left', wordBreak: false })
         .fontSize(10)
         .text('Sistema de Gestión de Almacén Oficial', 50, 58);

      doc.fontSize(12)
         .text('COMPROBANTE DE COMPRA', 300, 30, { align: 'right' })
         .fontSize(14)
         .font('Helvetica-Bold')
         .text(`Pedido #${order.id}`, 300, 50, { align: 'right' })
         .font('Helvetica');

      doc.moveDown(4);

      // Order Info Box
      doc.fillColor('#000000');
      const startY = 130;
      doc.fontSize(10).font('Helvetica-Bold').text('CLIENTE:', 50, startY);
      doc.font('Helvetica').text(`${order.cliente_nombre || 'Cliente General'}`, 130, startY);
      doc.fontSize(10).font('Helvetica-Bold').text('EMAIL:', 50, startY + 18);
      doc.font('Helvetica').text(`${order.cliente_email || '-'}`, 130, startY + 18);
      doc.fontSize(10).font('Helvetica-Bold').text('FECHA:', 50, startY + 36);
      doc.font('Helvetica').text(`${new Date(order.fecha).toLocaleString('es-CR')}`, 130, startY + 36);

      doc.fontSize(10).font('Helvetica-Bold').text('TIPO ENTREGA:', 320, startY);
      doc.font('Helvetica').text(`${order.tipo_entrega || 'Sucursal'}`, 410, startY);
      doc.fontSize(10).font('Helvetica-Bold').text('ESTADO:', 320, startY + 18);
      doc.font('Helvetica').text(`${order.estado || 'Pendiente'}`, 410, startY + 18);

      // Draw horizontal line
      doc.strokeColor('#CCCCCC').lineWidth(1).moveTo(50, startY + 60).lineTo(562, startY + 60).stroke();

      // Articles Table
      let currentY = startY + 80;
      doc.fillColor('#F2F2F2').rect(50, currentY, 512, 22).fill();
      doc.fillColor('#1C2541').font('Helvetica-Bold').fontSize(9);
      doc.text('Artículo', 60, currentY + 6);
      doc.text('Cant.', 320, currentY + 6, { width: 50, align: 'center' });
      doc.text('Precio Unit.', 380, currentY + 6, { width: 80, align: 'right' });
      doc.text('Subtotal', 470, currentY + 6, { width: 80, align: 'right' });

      doc.font('Helvetica').fillColor('#333333');
      currentY += 22;

      for (const item of items) {
        doc.text(`${item.nombre}`, 60, currentY + 6);
        doc.text(`${item.cantidad}`, 320, currentY + 6, { width: 50, align: 'center' });
        doc.text(`${formatColones(item.precio_unitario)}`, 380, currentY + 6, { width: 80, align: 'right' });
        doc.text(`${formatColones(item.precio_unitario * item.cantidad)}`, 470, currentY + 6, { width: 80, align: 'right' });
        currentY += 20;
      }

      // Summary
      doc.strokeColor('#CCCCCC').lineWidth(1).moveTo(50, currentY + 10).lineTo(562, currentY + 10).stroke();
      currentY += 20;

      doc.font('Helvetica-Bold').text('Subtotal:', 380, currentY, { width: 80, align: 'right' });
      doc.font('Helvetica').text(`${formatColones(order.subtotal)}`, 470, currentY, { width: 80, align: 'right' });
      
      currentY += 16;
      doc.font('Helvetica-Bold').text('IVA (13%):', 380, currentY, { width: 80, align: 'right' });
      doc.font('Helvetica').text(`${formatColones(order.impuesto)}`, 470, currentY, { width: 80, align: 'right' });
      
      if (order.costo_envio > 0) {
        currentY += 16;
        doc.font('Helvetica-Bold').text('Costo Envío:', 380, currentY, { width: 80, align: 'right' });
        doc.font('Helvetica').text(`${formatColones(order.costo_envio)}`, 470, currentY, { width: 80, align: 'right' });
      }

      currentY += 20;
      doc.font('Helvetica-Bold').fontSize(11).text('Total Final:', 380, currentY, { width: 80, align: 'right' });
      doc.fontSize(11).text(`${formatColones(order.total)}`, 470, currentY, { width: 80, align: 'right' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

// GET /api/v1/inventario/racks
exports.getRacks = async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM vista_mapa_racks');
    return res.status(200).json({
      success: true,
      data: rows
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/inventario/comprar (Exclusivo Rol 1 y Rol 4 - Cliente emite orden de compra)
exports.comprar = async (req, res, next) => {
  const { usuario_id, items, articulo_id, cantidad, telefono, tipo_entrega, direccion, telefono_contacto, direccion_envio } = req.body;

  let itemsArray = items;
  if (!itemsArray && articulo_id) {
    itemsArray = [{ articulo_id, cantidad }];
  }

  if (!itemsArray || !Array.isArray(itemsArray) || itemsArray.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Un arreglo de artículos ("items") es requerido'
    });
  }

  // Set default delivery type to 'Retiro en Lugar' if not provided for backward compatibility
  let selectedTipoEntrega = tipo_entrega || 'Retiro en Lugar';
  if (selectedTipoEntrega === 'Envío Express' || selectedTipoEntrega === 'express') {
    selectedTipoEntrega = 'Express';
  } else if (selectedTipoEntrega === 'sucursal') {
    selectedTipoEntrega = 'Retiro en Lugar';
  }

  if (!['Express', 'Retiro en Lugar'].includes(selectedTipoEntrega)) {
    return res.status(400).json({
      success: false,
      message: 'Tipo de entrega inválido. Debe ser "Express" o "Retiro en Lugar".'
    });
  }

  const inputDireccion = direccion_envio || direccion;
  // Validate address if Express delivery
  if (selectedTipoEntrega === 'Express' && (!inputDireccion || !inputDireccion.trim())) {
    return res.status(400).json({
      success: false,
      message: 'La dirección de entrega es requerida para entregas Express.'
    });
  }

  const selectedDireccion = selectedTipoEntrega === 'Express' ? inputDireccion.trim() : null;
  const telefonoContacto = telefono_contacto || telefono || null;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Verify role (Rol 1 = Cliente, Rol 4 = Inventario)
    await verifyUserRole(connection, usuario_id, [1, 4]);

    // Update client phone number if provided in profile
    if (telefonoContacto) {
      await connection.query(
        'UPDATE usuarios SET telefono = ? WHERE id = ?',
        [telefonoContacto, usuario_id]
      );
    }

    // Create the client order with placeholder totals first
    const [orderResult] = await connection.query(
      `INSERT INTO pedidos (
        cliente_id, subtotal, impuesto_iva, impuesto, total, 
        tipo_entrega, direccion_entrega, direccion_envio, telefono_contacto, estado
      ) VALUES (?, 0, 0, 0, 0, ?, ?, ?, ?, "Pendiente")`,
      [usuario_id, selectedTipoEntrega, selectedDireccion, selectedDireccion, telefonoContacto]
    );
    const pedidoId = orderResult.insertId;

    const processedItems = [];
    let subtotal = 0;

    for (const item of itemsArray) {
      const artId = item.articulo_id || item.id;
      const qtyVal = item.cantidad;
      if (!artId || qtyVal === undefined) {
        throw { statusCode: 400, message: 'ID de artículo y cantidad son requeridos para cada elemento' };
      }

      const qty = parseInt(qtyVal, 10);
      if (isNaN(qty) || qty <= 0) {
        throw { statusCode: 400, message: 'La cantidad debe ser un número entero mayor a cero' };
      }

      // Fetch article name and base price
      const [articles] = await connection.query(
        'SELECT nombre, precio_base FROM articulos WHERE id = ?',
        [artId]
      );
      if (articles.length === 0) {
        throw { statusCode: 400, message: 'Artículo no encontrado' };
      }
      const article = articles[0];
      const price = parseFloat(article.precio_base) || 0;
      subtotal += price * qty;

      // Check Alisto stock to validate the order (but don't subtract yet!)
      const [positions] = await connection.query(
        'SELECT cantidad_actual FROM posiciones_rack WHERE articulo_id = ? AND tipo = "Alisto" AND piso IN (1, 2, 3)',
        [artId]
      );
      const totalAlistoStock = positions.reduce((sum, pos) => sum + pos.cantidad_actual, 0);
      if (totalAlistoStock < qty) {
        throw {
          statusCode: 400,
          message: `Stock insuficiente en piso de venta para el artículo: ${article.nombre}`
        };
      }

      // Insert into pedido_items (existing table)
      await connection.query(
        'INSERT INTO pedido_items (pedido_id, articulo_id, cantidad) VALUES (?, ?, ?)',
        [pedidoId, artId, qty]
      );

      // Insert into pedido_detalles (new table)
      await connection.query(
        'INSERT INTO pedido_detalles (pedido_id, articulo_id, cantidad) VALUES (?, ?, ?)',
        [pedidoId, artId, qty]
      );

      // Record order placement in history as COMPRA_CLIENTE
      await connection.query(
        'INSERT INTO historial_movimientos (usuario_id, cliente_id, articulo_id, tipo_movimiento, cantidad) VALUES (?, ?, ?, "COMPRA_CLIENTE", ?)',
        [usuario_id, usuario_id, artId, qty]
      );

      processedItems.push({
        articulo: article.nombre,
        cantidad: qty,
        precio_unitario: price,
        subtotal: price * qty
      });
    }

    // Calculate Costa Rican IVA (13%) and grand total
    const impuestoIva = subtotal * 0.13;
    const total = subtotal + impuestoIva;

    // Update order with computed monetary totals
    await connection.query(
      'UPDATE pedidos SET subtotal = ?, impuesto_iva = ?, impuesto = ?, total = ? WHERE id = ?',
      [subtotal, impuestoIva, impuestoIva, total, pedidoId]
    );

    await connection.commit();

    const articleNamesStr = processedItems.map(p => `${p.cantidad} unidades de "${p.articulo}"`).join(', ');

    return res.status(200).json({
      success: true,
      message: `¡Pedido creado con éxito! Se ha registrado el pedido #${pedidoId} con: ${articleNamesStr}.`,
      data: {
        pedido_id: pedidoId,
        estado: 'Pendiente',
        subtotal,
        impuesto: impuestoIva,
        impuesto_iva: impuestoIva,
        total,
        tipo_entrega: selectedTipoEntrega,
        direccion_entrega: selectedDireccion,
        direccion_envio: selectedDireccion,
        articulos: processedItems
      }
    });

  } catch (error) {
    await connection.rollback();
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }
    next(error);
  } finally {
    connection.release();
  }
};

// POST /api/v1/inventario/reabastecer (Exclusivo Rol 3 y Rol 4)
exports.reabastecer = async (req, res, next) => {
  const { usuario_id, posicion_id, cantidad } = req.body;

  if (!posicion_id || cantidad === undefined) {
    return res.status(400).json({
      success: false,
      message: 'ID de posición y cantidad son requeridos'
    });
  }

  const qty = parseInt(cantidad, 10);
  if (isNaN(qty) || qty <= 0) {
    return res.status(400).json({
      success: false,
      message: 'La cantidad debe ser un número entero mayor a cero'
    });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Verify role (Rol 3 = Montacarguista, Rol 4 = Inventario)
    await verifyUserRole(connection, usuario_id, [3, 4]);

    // Fetch the target position (Alisto) details
    const [targetPositions] = await connection.query(
      'SELECT id, rack_nombre, piso, tipo, articulo_id, cantidad_actual FROM posiciones_rack WHERE id = ? FOR UPDATE',
      [posicion_id]
    );

    if (targetPositions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Posición de destino no encontrada'
      });
    }

    const targetPos = targetPositions[0];

    if (targetPos.tipo !== 'Alisto') {
      return res.status(400).json({
        success: false,
        message: 'La posición de destino elegida debe ser de tipo Alisto'
      });
    }

    const articulo_id = targetPos.articulo_id;

    // Fetch article limits
    const [articles] = await connection.query(
      'SELECT nombre, max_alisto FROM articulos WHERE id = ?',
      [articulo_id]
    );
    if (articles.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Artículo no encontrado'
      });
    }
    const article = articles[0];

    // Find Altura positions (pisos 4/5) to subtract from, prioritizing the same rack
    let [alturaPositions] = await connection.query(
      'SELECT id, rack_nombre, piso, cantidad_actual FROM posiciones_rack WHERE articulo_id = ? AND tipo = "Altura" AND rack_nombre = ? AND piso IN (4, 5) FOR UPDATE',
      [articulo_id, targetPos.rack_nombre]
    );

    // Fallback: If no Altura position is found in the same rack, search in any rack
    if (alturaPositions.length === 0) {
      const [allPositions] = await connection.query(
        'SELECT id, rack_nombre, piso, cantidad_actual FROM posiciones_rack WHERE articulo_id = ? AND tipo = "Altura" AND piso IN (4, 5) FOR UPDATE',
        [articulo_id]
      );
      alturaPositions = allPositions;
    }

    // Security check: If no Altura position exists at all for this article
    if (alturaPositions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No se encontró stock en Altura para este artículo'
      });
    }

    const totalAlturaStock = alturaPositions.reduce((sum, pos) => sum + pos.cantidad_actual, 0);
    if (totalAlturaStock < qty) {
      return res.status(400).json({
        success: false,
        message: `Existencias insuficientes en Altura para reabastecer. Stock disponible: ${totalAlturaStock}, Solicitado: ${qty}`
      });
    }

    const currentQty = targetPos.cantidad_actual;
    const capacityLimit = article.max_alisto;

    if (currentQty + qty > capacityLimit) {
      return res.status(400).json({
        success: false,
        message: `Violación de límite de capacidad en Alisto para la posición específica ${targetPos.rack_nombre} - Piso ${targetPos.piso}. Cantidad actual: ${currentQty}, Intentado reabastecer: ${qty}, Máximo permitido: ${capacityLimit}`
      });
    }

    // Deduct from Altura positions
    let remainingToDeduct = qty;
    for (const pos of alturaPositions) {
      if (remainingToDeduct <= 0) break;
      const toDeduct = Math.min(pos.cantidad_actual, remainingToDeduct);
      if (toDeduct > 0) {
        await connection.query(
          'UPDATE posiciones_rack SET cantidad_actual = cantidad_actual - ? WHERE id = ?',
          [toDeduct, pos.id]
        );
        // Record in movimientos_inventario
        await connection.query(
          'INSERT INTO movimientos_inventario (articulo_id, usuario_id, tipo_movimiento, cantidad, posicion_origen, posicion_destino) VALUES (?, ?, "REABASTECIMIENTO", ?, ?, ?)',
          [
            articulo_id,
            usuario_id,
            toDeduct,
            `${pos.rack_nombre} - Piso ${pos.piso}`,
            `${targetPos.rack_nombre} - Piso ${targetPos.piso}`
          ]
        );
        remainingToDeduct -= toDeduct;
      }
    }

    // Add to specific Alisto position
    await connection.query(
      'UPDATE posiciones_rack SET cantidad_actual = cantidad_actual + ? WHERE id = ?',
      [qty, targetPos.id]
    );

    // Record in history
    await connection.query(
      'INSERT INTO historial_movimientos (usuario_id, articulo_id, tipo_movimiento, cantidad) VALUES (?, ?, "REBASTECIMIENTO_ALISTO", ?)',
      [usuario_id, articulo_id, qty]
    );

    // Update any pending tasks for this article to 'Completado'
    await connection.query(
      "UPDATE tareas_pendientes SET estado = 'Completado' WHERE articulo_id = ? AND (estado = 'Pendiente' OR estado = 'PENDIENTE')",
      [articulo_id]
    );

    // Also update any pending solicitudes_reabastecimiento for this article to 'ATENDIDO'
    await connection.query(
      "UPDATE solicitudes_reabastecimiento SET estado = 'ATENDIDO' WHERE articulo_id = ? AND (estado = 'PENDIENTE_INVENTARIO' OR estado = 'PENDIENTE')",
      [articulo_id]
    );

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: 'Reabastecimiento de Alisto completado con éxito',
      data: {
        tipo_movimiento: 'REBASTECIMIENTO_ALISTO',
        articulo: article.nombre,
        cantidad: qty,
        alisto_actual: currentQty + qty,
        altura_restante: totalAlturaStock - qty
      }
    });

  } catch (error) {
    await connection.rollback();
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }
    next(error);
  } finally {
    connection.release();
  }
};

// POST /api/v1/inventario/despachar (Exclusivo Rol 2 y Rol 4)
exports.despachar = async (req, res, next) => {
  const { usuario_id, pedido_id, articulo_id, cantidad } = req.body;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Verify role (Rol 2 = Alistador, Rol 4 = Inventario)
    await verifyUserRole(connection, usuario_id, [2, 4]);

    if (pedido_id) {
      // Dispatch via Pedido
      const [orders] = await connection.query(
        "SELECT id, cliente_id, estado FROM pedidos WHERE id = ? FOR UPDATE",
        [pedido_id]
      );
      if (orders.length === 0) {
        return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
      }
      if (orders[0].estado !== 'Pendiente') {
        return res.status(400).json({ success: false, message: 'El pedido ya fue despachado o cancelado' });
      }

      const orderClienteId = orders[0].cliente_id;

      // Fetch order items
      const [items] = await connection.query(
        `SELECT pi.articulo_id, pi.cantidad, a.nombre 
         FROM pedido_items pi 
         JOIN articulos a ON pi.articulo_id = a.id 
         WHERE pi.pedido_id = ?`,
        [pedido_id]
      );

      const processed = [];

      for (const item of items) {
        const { articulo_id: artId, cantidad: qty, nombre: artNombre } = item;

        // Find Alisto positions (pisos 1/2/3) to subtract from
        const [positions] = await connection.query(
          'SELECT id, rack_nombre, piso, cantidad_actual FROM posiciones_rack WHERE articulo_id = ? AND tipo = "Alisto" AND piso IN (1, 2, 3) FOR UPDATE',
          [artId]
        );

        const totalAlistoStock = positions.reduce((sum, pos) => sum + pos.cantidad_actual, 0);
        if (totalAlistoStock < qty) {
          throw {
            statusCode: 400,
            message: `Stock insuficiente en piso de venta para el artículo: ${artNombre}`
          };
        }

        // Deduct sequentially
        let remainingToDeduct = qty;
        for (const pos of positions) {
          if (remainingToDeduct <= 0) break;
          const toDeduct = Math.min(pos.cantidad_actual, remainingToDeduct);
          if (toDeduct > 0) {
            await connection.query(
              'UPDATE posiciones_rack SET cantidad_actual = cantidad_actual - ? WHERE id = ?',
              [toDeduct, pos.id]
            );
            // Record in movimientos_inventario
            await connection.query(
              'INSERT INTO movimientos_inventario (articulo_id, usuario_id, tipo_movimiento, cantidad, posicion_origen, posicion_destino) VALUES (?, ?, "SALIDA", ?, ?, NULL)',
              [
                artId,
                usuario_id,
                toDeduct,
                `${pos.rack_nombre} - Piso ${pos.piso}`
              ]
            );
            remainingToDeduct -= toDeduct;
          }
        }

        // Record in history as DESPACHO_PEDIDO (storing both Alistador user_id and Client cliente_id)
        await connection.query(
          'INSERT INTO historial_movimientos (usuario_id, cliente_id, articulo_id, tipo_movimiento, cantidad) VALUES (?, ?, ?, "DESPACHO_PEDIDO", ?)',
          [usuario_id, orderClienteId, artId, qty]
        );

        processed.push({ articulo: artNombre, cantidad: qty });
      }

      // Update order status to Entregado and set alistador_id
      await connection.query(
        "UPDATE pedidos SET estado = 'Entregado', alistador_id = ? WHERE id = ?",
        [usuario_id, pedido_id]
      );

      await connection.commit();
      return res.status(200).json({
        success: true,
        message: `Pedido #${pedido_id} despachado con éxito`,
        data: {
          pedido_id,
          estado: 'Entregado',
          articulos: processed
        }
      });

    } else {
      // Direct dispatch (backward compatibility)
      if (!articulo_id || cantidad === undefined) {
        return res.status(400).json({ success: false, message: 'articulo_id y cantidad son requeridos' });
      }

      const qty = parseInt(cantidad, 10);
      if (isNaN(qty) || qty <= 0) {
        return res.status(400).json({ success: false, message: 'Cantidad inválida' });
      }

      const [articles] = await connection.query('SELECT nombre FROM articulos WHERE id = ?', [articulo_id]);
      if (articles.length === 0) {
        return res.status(400).json({ success: false, message: 'Artículo no encontrado' });
      }
      const article = articles[0];

      const [positions] = await connection.query(
        'SELECT id, rack_nombre, piso, cantidad_actual FROM posiciones_rack WHERE articulo_id = ? AND tipo = "Alisto" AND piso IN (1, 2, 3) FOR UPDATE',
        [articulo_id]
      );

      const totalAlistoStock = positions.reduce((sum, pos) => sum + pos.cantidad_actual, 0);
      if (totalAlistoStock < qty) {
        return res.status(400).json({
          success: false,
          message: `Existencias insuficientes en Alisto para despachar. Stock disponible: ${totalAlistoStock}, Solicitado: ${qty}`
        });
      }

      let remainingToDeduct = qty;
      for (const pos of positions) {
        if (remainingToDeduct <= 0) break;
        const toDeduct = Math.min(pos.cantidad_actual, remainingToDeduct);
        if (toDeduct > 0) {
          await connection.query(
            'UPDATE posiciones_rack SET cantidad_actual = cantidad_actual - ? WHERE id = ?',
            [toDeduct, pos.id]
          );
          // Record in movimientos_inventario
          await connection.query(
            'INSERT INTO movimientos_inventario (articulo_id, usuario_id, tipo_movimiento, cantidad, posicion_origen, posicion_destino) VALUES (?, ?, "SALIDA", ?, ?, NULL)',
            [
              articulo_id,
              usuario_id,
              toDeduct,
              `${pos.rack_nombre} - Piso ${pos.piso}`
            ]
          );
          remainingToDeduct -= toDeduct;
        }
      }

      await connection.query(
        'INSERT INTO historial_movimientos (usuario_id, cliente_id, articulo_id, tipo_movimiento, cantidad) VALUES (?, NULL, ?, "DESPACHO_PEDIDO", ?)',
        [usuario_id, articulo_id, qty]
      );

      await connection.commit();
      return res.status(200).json({
        success: true,
        message: `Despacho exitoso: se restaron ${qty} unidades de "${article.nombre}".`,
        data: {
          alisto_restante: totalAlistoStock - qty
        }
      });
    }

  } catch (error) {
    await connection.rollback();
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  } finally {
    connection.release();
  }
};

// POST /api/v1/inventario/ajuste-dano (Exclusivo Rol 4)
exports.ajusteDano = async (req, res, next) => {
  const { usuario_id, articulo_id, piso, cantidad, detalle_dano } = req.body;

  if (detalle_dano === undefined || detalle_dano === null || String(detalle_dano).trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'Es obligatorio detallar el motivo por el cual la mercadería se reporta como dañada'
    });
  }

  if (!articulo_id || piso === undefined || cantidad === undefined) {
    return res.status(400).json({
      success: false,
      message: 'ID de artículo, piso y cantidad son requeridos'
    });
  }

  const targetPiso = parseInt(piso, 10);
  const qty = parseInt(cantidad, 10);

  if (isNaN(targetPiso) || isNaN(qty) || qty <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Piso y cantidad deben ser números enteros, con cantidad mayor a cero'
    });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Verify role (Rol 4 = Inventario)
    await verifyUserRole(connection, usuario_id, [4]);

    // Fetch article details
    const [articles] = await connection.query(
      'SELECT nombre FROM articulos WHERE id = ?',
      [articulo_id]
    );
    if (articles.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Artículo no encontrado'
      });
    }
    const article = articles[0];

    // Find the specific position matching articulo_id and piso
    const [positions] = await connection.query(
      'SELECT id, rack_nombre, cantidad_actual FROM posiciones_rack WHERE articulo_id = ? AND piso = ? FOR UPDATE',
      [articulo_id, targetPiso]
    );

    if (positions.length === 0) {
      return res.status(400).json({
        success: false,
        message: `No se encontró una posición asignada para el artículo ${article.nombre} en el piso ${targetPiso}`
      });
    }

    const position = positions[0];
    if (position.cantidad_actual < qty) {
      return res.status(400).json({
        success: false,
        message: `Existencias insuficientes para realizar el ajuste por daño. Disponible en piso ${targetPiso}: ${position.cantidad_actual}, Requerido restar: ${qty}`
      });
    }

    // Subtract from position
    await connection.query(
      'UPDATE posiciones_rack SET cantidad_actual = cantidad_actual - ? WHERE id = ?',
      [qty, position.id]
    );

    // Record in history
    await connection.query(
      'INSERT INTO historial_movimientos (usuario_id, articulo_id, tipo_movimiento, cantidad) VALUES (?, ?, "AJUSTE_DAÑO", ?)',
      [usuario_id, articulo_id, qty]
    );

    // Record in movimientos_inventario
    await connection.query(
      'INSERT INTO movimientos_inventario (articulo_id, usuario_id, tipo_movimiento, cantidad, posicion_origen, posicion_destino, detalle_dano) VALUES (?, ?, "AJUSTE", ?, ?, NULL, ?)',
      [articulo_id, usuario_id, qty, position.rack_nombre, detalle_dano]
    );

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: 'Ajuste por daño registrado con éxito',
      data: {
        tipo_movimiento: 'AJUSTE_DAÑO',
        articulo: article.nombre,
        piso: targetPiso,
        cantidad_restada: qty,
        nueva_cantidad: position.cantidad_actual - qty
      }
    });

  } catch (error) {
    await connection.rollback();
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }
    next(error);
  } finally {
    connection.release();
  }
};

// POST /api/v1/inventario/solicitar-reabastecimiento (Exclusivo Rol 4)
exports.solicitarReabastecimiento = async (req, res, next) => {
  const { usuario_id, articulo_id } = req.body;

  if (!articulo_id) {
    return res.status(400).json({
      success: false,
      message: 'ID de artículo es requerido'
    });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Verify role (Rol 4 = Inventario)
    await verifyUserRole(connection, usuario_id, [4]);

    // Check if article is valid
    const [articles] = await connection.query('SELECT nombre FROM articulos WHERE id = ?', [articulo_id]);
    if (articles.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Artículo no encontrado'
      });
    }
    const article = articles[0];

    // Check if a pending task already exists for this article
    const [existing] = await connection.query(
      "SELECT id FROM tareas_pendientes WHERE articulo_id = ? AND estado = 'Pendiente'",
      [articulo_id]
    );

    if (existing.length > 0) {
      await connection.commit();
      return res.status(200).json({
        success: true,
        message: `Ya existe una solicitud de reabastecimiento pendiente para el artículo: ${article.nombre}`
      });
    }

    // Insert new task
    await connection.query(
      "INSERT INTO tareas_pendientes (articulo_id, solicitado_por) VALUES (?, ?)",
      [articulo_id, usuario_id]
    );

    await connection.commit();
    return res.status(200).json({
      success: true,
      message: `Solicitud de reabastecimiento creada con éxito para: ${article.nombre}`
    });

  } catch (error) {
    await connection.rollback();
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }
    next(error);
  } finally {
    connection.release();
  }
};

// GET /api/v1/inventario/tareas-pendientes
exports.getTareasPendientes = async (req, res, next) => {
  try {
    const query = `
      SELECT 
        tp.id,
        tp.articulo_id,
        a.nombre AS articulo,
        tp.solicitado_por,
        u.nombre AS solicitado_por_nombre,
        tp.estado,
        tp.fecha_creacion
      FROM tareas_pendientes tp
      JOIN articulos a ON tp.articulo_id = a.id
      JOIN usuarios u ON tp.solicitado_por = u.id
      WHERE tp.estado = 'Pendiente'
      ORDER BY tp.fecha_creacion ASC
    `;
    const [rows] = await pool.query(query);
    return res.status(200).json({
      success: true,
      data: rows
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/inventario/incrementar-stock (Exclusivo Rol 4)
exports.incrementarStock = async (req, res, next) => {
  const { usuario_id, articulo_id, piso, cantidad } = req.body;

  if (!articulo_id || !piso || cantidad === undefined) {
    return res.status(400).json({
      success: false,
      message: 'ID de artículo, piso y cantidad son requeridos'
    });
  }

  const qty = parseInt(cantidad, 10);
  const targetPiso = parseInt(piso, 10);
  if (isNaN(qty) || qty <= 0 || isNaN(targetPiso) || targetPiso < 1 || targetPiso > 5) {
    return res.status(400).json({
      success: false,
      message: 'La cantidad debe ser mayor a cero y el piso debe estar entre 1 y 5'
    });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Verify role (Rol 4 = Inventario)
    await verifyUserRole(connection, usuario_id, [4]);

    // Fetch article details
    const [articles] = await connection.query('SELECT nombre FROM articulos WHERE id = ?', [articulo_id]);
    if (articles.length === 0) {
      return res.status(400).json({ success: false, message: 'Artículo no encontrado' });
    }
    const article = articles[0];

    // Find the specific position
    const [positions] = await connection.query(
      'SELECT id, rack_nombre, cantidad_actual FROM posiciones_rack WHERE articulo_id = ? AND piso = ? FOR UPDATE',
      [articulo_id, targetPiso]
    );

    if (positions.length === 0) {
      return res.status(400).json({
        success: false,
        message: `No se encontró una posición asignada para el artículo ${article.nombre} en el piso ${targetPiso}`
      });
    }

    const position = positions[0];

    // Increment stock
    await connection.query(
      'UPDATE posiciones_rack SET cantidad_actual = cantidad_actual + ? WHERE id = ?',
      [qty, position.id]
    );

    // Record in history as AJUSTE_INGRESO
    await connection.query(
      'INSERT INTO historial_movimientos (usuario_id, articulo_id, tipo_movimiento, cantidad) VALUES (?, ?, "AJUSTE_INGRESO", ?)',
      [usuario_id, articulo_id, qty]
    );

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: 'Ajuste de ingreso registrado con éxito',
      data: {
        tipo_movimiento: 'AJUSTE_INGRESO',
        articulo: article.nombre,
        piso: targetPiso,
        cantidad_adicionada: qty,
        nueva_cantidad: position.cantidad_actual + qty
      }
    });

  } catch (error) {
    await connection.rollback();
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  } finally {
    connection.release();
  }
};

// GET /api/v1/inventario/pedidos-pendientes
exports.getPedidosPendientes = async (req, res, next) => {
  try {
    const [orders] = await pool.query(
      `SELECT p.id, p.cliente_id, u.nombre AS cliente_nombre, u.telefono AS cliente_telefono, 
              p.subtotal, p.impuesto_iva, p.total, p.tipo_entrega, p.direccion_entrega, 
              p.estado, p.fecha_creacion 
       FROM pedidos p 
       JOIN usuarios u ON p.cliente_id = u.id 
       WHERE p.estado = 'Pendiente' 
       ORDER BY p.fecha_creacion DESC`
    );

    for (const order of orders) {
      const [items] = await pool.query(
        `SELECT pi.articulo_id, a.nombre AS articulo, pi.cantidad 
         FROM pedido_items pi 
         JOIN articulos a ON pi.articulo_id = a.id 
         WHERE pi.pedido_id = ?`,
        [order.id]
      );
      order.items = items;
    }

    return res.status(200).json({
      success: true,
      data: orders
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/inventario/solicitar-abasto-inventario (Exclusivo Rol 2 y 4)
exports.solicitarAbastoInventario = async (req, res, next) => {
  const { usuario_id, articulo_id } = req.body;

  if (!articulo_id) {
    return res.status(400).json({ success: false, message: 'ID de artículo es requerido' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Verify role (Rol 2 = Alistador, Rol 4 = Inventario)
    await verifyUserRole(connection, usuario_id, [2, 4]);

    // Check if article is valid
    const [articles] = await connection.query('SELECT nombre FROM articulos WHERE id = ?', [articulo_id]);
    if (articles.length === 0) {
      return res.status(400).json({ success: false, message: 'Artículo no encontrado' });
    }
    const article = articles[0];

    // Check if there is already a pending request
    const [existing] = await connection.query(
      "SELECT id FROM solicitudes_reabastecimiento WHERE articulo_id = ? AND estado = 'PENDIENTE_INVENTARIO'",
      [articulo_id]
    );
    if (existing.length > 0) {
      await connection.commit();
      return res.status(200).json({
        success: true,
        message: `Ya existe una solicitud pendiente de reabastecimiento a Inventario para: ${article.nombre}`
      });
    }

    // Insert request
    await connection.query(
      "INSERT INTO solicitudes_reabastecimiento (articulo_id, solicitado_por) VALUES (?, ?)",
      [articulo_id, usuario_id]
    );

    await connection.commit();
    return res.status(200).json({
      success: true,
      message: `Solicitud de reabastecimiento a Inventario registrada con éxito para: ${article.nombre}`
    });

  } catch (error) {
    await connection.rollback();
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  } finally {
    connection.release();
  }
};

// GET /api/v1/inventario/solicitudes-abasto
exports.getSolicitudesAbasto = async (req, res, next) => {
  try {
    const query = `
      SELECT 
        sr.id,
        sr.articulo_id,
        a.nombre AS articulo,
        sr.solicitado_por,
        u.nombre AS solicitado_por_nombre,
        sr.estado,
        sr.fecha_creacion
      FROM solicitudes_reabastecimiento sr
      JOIN articulos a ON sr.articulo_id = a.id
      JOIN usuarios u ON sr.solicitado_por = u.id
      WHERE sr.estado = 'PENDIENTE_INVENTARIO'
      ORDER BY sr.fecha_creacion ASC
    `;
    const [rows] = await pool.query(query);
    return res.status(200).json({
      success: true,
      data: rows
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/inventario/compra-abastecimiento (Exclusivo Rol 4)
exports.compraAbastecimiento = async (req, res, next) => {
  const { usuario_id, items, articulo_id, cantidad } = req.body;

  let itemsArray = items;
  if (!itemsArray && articulo_id) {
    itemsArray = [{ articulo_id, cantidad }];
  }

  if (!itemsArray || !Array.isArray(itemsArray) || itemsArray.length === 0) {
    return res.status(400).json({ success: false, message: 'Un arreglo de artículos ("items") es requerido' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Verify role (Rol 4 = Inventario)
    await verifyUserRole(connection, usuario_id, [4]);

    const processedItems = [];

    for (const item of itemsArray) {
      const { articulo_id: artId, cantidad: qtyVal } = item;
      if (!artId || qtyVal === undefined) {
        throw { statusCode: 400, message: 'ID de artículo y cantidad son requeridos' };
      }

      const qty = parseInt(qtyVal, 10);
      if (isNaN(qty) || qty <= 0) {
        throw { statusCode: 400, message: 'La cantidad debe ser mayor a cero' };
      }

      // Fetch article limits
      const [articles] = await connection.query(
        'SELECT nombre, max_altura FROM articulos WHERE id = ?',
        [artId]
      );
      if (articles.length === 0) {
        throw { statusCode: 400, message: 'Artículo no encontrado' };
      }
      const article = articles[0];

      // Find Altura positions (pisos 4/5)
      const [positions] = await connection.query(
        'SELECT id, rack_nombre, piso, cantidad_actual FROM posiciones_rack WHERE articulo_id = ? AND tipo = "Altura" AND piso IN (4, 5) FOR UPDATE',
        [artId]
      );

      if (positions.length === 0) {
        throw { statusCode: 400, message: `No se encontraron posiciones de Altura para el artículo: ${article.nombre}` };
      }

      const totalCurrent = positions.reduce((sum, pos) => sum + pos.cantidad_actual, 0);
      const capacityLimit = article.max_altura;

      if (totalCurrent + qty > capacityLimit) {
        throw {
          statusCode: 400,
          message: `Límite de capacidad en Altura excedido para ${article.nombre}. Disponible: ${capacityLimit - totalCurrent}, Intentando agregar: ${qty}`
        };
      }

      // Add stock to first position
      const targetPosition = positions[0];
      await connection.query(
        'UPDATE posiciones_rack SET cantidad_actual = cantidad_actual + ? WHERE id = ?',
        [qty, targetPosition.id]
      );

      // Record in history as COMPRA_ABASTECIMIENTO
      await connection.query(
        'INSERT INTO historial_movimientos (usuario_id, articulo_id, tipo_movimiento, cantidad) VALUES (?, ?, "COMPRA_ABASTECIMIENTO", ?)',
        [usuario_id, artId, qty]
      );

      // Clear any pending Alistador requests for this article (since it is now replenished)
      await connection.query(
        "UPDATE solicitudes_reabastecimiento SET estado = 'ATENDIDO' WHERE articulo_id = ? AND estado = 'PENDIENTE_INVENTARIO'",
        [artId]
      );

      processedItems.push({ articulo: article.nombre, cantidad: qty });
    }

    await connection.commit();

    const articleNamesStr = processedItems.map(p => `${p.cantidad} unidades de "${p.articulo}"`).join(', ');
    return res.status(200).json({
      success: true,
      message: `¡Abastecimiento de bodega completado con éxito! Se han recibido: ${articleNamesStr}.`,
      data: {
        tipo_movimiento: 'COMPRA_ABASTECIMIENTO',
        articulos: processedItems
      }
    });

  } catch (error) {
    await connection.rollback();
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  } finally {
    connection.release();
  }
};

// =========================================================================
// 4. MÓDULO DE ADMINISTRACIÓN (EXCLUSIVO ROL 5 - ADMINISTRADOR)
// =========================================================================

// GET /api/v1/admin/usuarios (Exclusivo Rol 5 - Administrador)
exports.getUsuarios = async (req, res, next) => {
  const { requester_id } = req.query;

  const connection = await pool.getConnection();
  try {
    // Verify role is Admin (5)
    await verifyUserRole(connection, requester_id, [5]);

    // CORRECCIÓN: Agregamos "WHERE u.activo = 1" para ignorar a los usuarios borrados lógicamente
    const [rows] = await connection.query(
      `SELECT u.id, u.nombre, u.email, u.telefono, u.rol_id, r.nombre AS rol_nombre 
       FROM usuarios u 
       LEFT JOIN roles r ON u.rol_id = r.id
       WHERE u.activo = 1
       ORDER BY u.nombre ASC`
    );

    return res.status(200).json({
      success: true,
      data: rows
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }
    next(error);
  } finally {
    connection.release();
  }
};

// POST /api/v1/admin/crear-usuario (Exclusivo Rol 5 - Administrador)
exports.crearUsuario = async (req, res, next) => {
  const { requester_id, nombre, email, password, telefono, rol_id } = req.body;

  if (!nombre || !email || !password || !rol_id) {
    return res.status(400).json({
      success: false,
      message: 'Todos los campos (nombre, email, password, rol_id) son requeridos'
    });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Verify role is Admin (5)
    await verifyUserRole(connection, requester_id, [5]);

    // Check if email already exists
    const [existing] = await connection.query('SELECT id FROM usuarios WHERE email = ?', [email.trim().toLowerCase()]);
    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'El correo electrónico ingresado ya se encuentra registrado'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    // Insert new user (Por defecto se crea activo)
    const insertQuery = `
      INSERT INTO usuarios (nombre, email, password, telefono, rol_id)
      VALUES (?, ?, ?, ?, ?)
    `;
    const [result] = await connection.query(insertQuery, [
      nombre.trim(),
      email.trim().toLowerCase(),
      hashedPassword,
      telefono || '8888-8888',
      rol_id
    ]);

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: 'Usuario creado con éxito',
      data: {
        id: result.insertId,
        nombre: nombre.trim(),
        email: email.trim().toLowerCase(),
        telefono: telefono || '8888-8888',
        rol_id
      }
    });
  } catch (error) {
    await connection.rollback();
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }
    next(error);
  } finally {
    connection.release();
  }
};

// GET /api/v1/admin/pedidos-global (Exclusivo Rol 5 - Administrador)
exports.getPedidosGlobal = async (req, res, next) => {
  const { requester_id } = req.query;

  const connection = await pool.getConnection();
  try {
    // Verify role is Admin (5)
    await verifyUserRole(connection, requester_id, [5]);

    const [rows] = await connection.query(
      `SELECT p.id AS pedido_id, 
              u_cliente.nombre AS cliente_nombre, 
              u_alistador.nombre AS alistador_nombre, 
              p.total, 
              p.estado,
              p.fecha_creacion
       FROM pedidos p
       LEFT JOIN usuarios u_cliente ON p.cliente_id = u_cliente.id
       LEFT JOIN usuarios u_alistador ON p.alistador_id = u_alistador.id
       ORDER BY p.fecha_creacion DESC`
    );

    return res.status(200).json({
      success: true,
      data: rows
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }
    next(error);
  } finally {
    connection.release();
  }
};

// DELETE /api/v1/admin/usuarios/:id (Exclusivo Rol 5 - Administrador)
exports.eliminarUsuario = async (req, res, next) => {
  const { id } = req.params;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Verificar si el usuario existe directo
    const [existing] = await connection.query('SELECT id FROM usuarios WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // 2. Aplicar el borrado lógico directo sin validar requester_id
    await connection.query('UPDATE usuarios SET activo = 0 WHERE id = ?', [id]);

    await connection.commit();

    // 3. Mensaje exacto que espera el frontend
    return res.status(200).json({
      success: true,
      message: 'Usuario eliminado con éxito'
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

// POST /api/v1/inventario/crear-pedido (Nuevo Módulo de Cliente/Comprador - Costa Rica)
exports.crearPedidoCliente = async (req, res, next) => {
  const { cliente_id, productos, tipo_entrega, telefono_contacto, direccion_envio, enGAM } = req.body;

  if (!cliente_id) {
    return res.status(400).json({ success: false, message: 'El cliente_id es requerido' });
  }

  if (!productos || !Array.isArray(productos) || productos.length === 0) {
    return res.status(400).json({ success: false, message: 'El arreglo de productos es requerido y no puede estar vacío' });
  }

  const selectedTipoEntrega = tipo_entrega || 'sucursal';
  if (!['express', 'sucursal'].includes(selectedTipoEntrega)) {
    return res.status(400).json({ success: false, message: 'Tipo de entrega inválido. Debe ser "express" o "sucursal"' });
  }

  if (selectedTipoEntrega === 'express' && (!direccion_envio || !direccion_envio.trim())) {
    return res.status(400).json({ success: false, message: 'La dirección de envío es requerida para entregas express' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Validar existencia del cliente
    const [userRows] = await connection.query('SELECT nombre, email FROM usuarios WHERE id = ? AND activo = 1', [cliente_id]);
    if (userRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Cliente no encontrado o inactivo' });
    }

    let subtotal = 0;
    const processedItems = [];

    // Calcular montos y validar/descontar stock
    for (const item of productos) {
      const artId = item.id || item.articulo_id;
      const qtyVal = item.cantidad;

      if (!artId || qtyVal === undefined) {
        throw { statusCode: 400, message: 'El id de artículo y la cantidad son requeridos para cada producto' };
      }

      const qty = parseInt(qtyVal, 10);
      if (isNaN(qty) || qty <= 0) {
        throw { statusCode: 400, message: 'La cantidad debe ser un número entero mayor a cero' };
      }

      // Consultar precio base del artículo
      const [articles] = await connection.query(
        'SELECT nombre, precio_base FROM articulos WHERE id = ?',
        [artId]
      );
      if (articles.length === 0) {
        throw { statusCode: 404, message: `Artículo con ID ${artId} no encontrado` };
      }
      const article = articles[0];
      const price = parseFloat(article.precio_base) || 0;
      subtotal += price * qty;

      // Validar stock en posiciones de Alisto (pisos 1, 2, 3)
      const [positions] = await connection.query(
        'SELECT id, rack_nombre, piso, cantidad_actual FROM posiciones_rack WHERE articulo_id = ? AND tipo = "Alisto" AND piso IN (1, 2, 3) FOR UPDATE',
        [artId]
      );

      const totalAlistoStock = positions.reduce((sum, pos) => sum + pos.cantidad_actual, 0);
      if (totalAlistoStock < qty) {
        throw {
          statusCode: 400,
          message: `Stock insuficiente en piso de venta para el artículo: ${article.nombre}. Stock disponible: ${totalAlistoStock}`
        };
      }

      // Hacer el descuento secuencial de stock
      let remainingToDeduct = qty;
      for (const pos of positions) {
        if (remainingToDeduct <= 0) break;
        const toDeduct = Math.min(pos.cantidad_actual, remainingToDeduct);
        if (toDeduct > 0) {
          await connection.query(
            'UPDATE posiciones_rack SET cantidad_actual = cantidad_actual - ? WHERE id = ?',
            [toDeduct, pos.id]
          );
          remainingToDeduct -= toDeduct;
        }
      }

      // Registrar movimiento en el historial
      await connection.query(
        'INSERT INTO historial_movimientos (usuario_id, cliente_id, articulo_id, tipo_movimiento, cantidad) VALUES (?, ?, ?, "COMPRA_CLIENTE", ?)',
        [cliente_id, cliente_id, artId, qty]
      );

      processedItems.push({
        articulo_id: artId,
        nombre: article.nombre,
        cantidad: qty,
        precio_unitario: price,
        subtotal: price * qty
      });
    }

    const impuesto = subtotal * 0.13;
    
    // Cálculo de costo de envío express para Costa Rica con IVA Incluido
    let costoEnvio = 0;
    if (selectedTipoEntrega === 'express') {
      const esGAM = !!enGAM;
      costoEnvio = esGAM ? 5000 : 7000;
      const montoParaBeneficio = subtotal + impuesto;
      if (esGAM && montoParaBeneficio >= 100000) {
        costoEnvio = 0;
      } else if (!esGAM && montoParaBeneficio >= 150000) {
        costoEnvio = 0;
      }
    }

    const totalFinal = subtotal + impuesto + costoEnvio;

    // Insertar en la tabla pedidos (poblando tanto campos nuevos como antiguos para compatibilidad)
    const [orderResult] = await connection.query(
      `INSERT INTO pedidos (
        cliente_id, subtotal, impuesto_iva, impuesto, costo_envio, total, 
        tipo_entrega, direccion_entrega, direccion_envio, telefono_contacto, estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pendiente')`,
      [
        cliente_id, subtotal, impuesto, impuesto, costoEnvio, totalFinal,
        selectedTipoEntrega,
        selectedTipoEntrega === 'express' ? direccion_envio.trim() : null,
        selectedTipoEntrega === 'express' ? direccion_envio.trim() : null,
        telefono_contacto || null
      ]
    );

    const pedidoId = orderResult.insertId;

    // Insertar detalles en pedido_detalles, pedido_items y detalle_pedido para compatibilidad y Workbench
    for (const item of processedItems) {
      await connection.query(
        'INSERT INTO pedido_detalles (pedido_id, articulo_id, cantidad) VALUES (?, ?, ?)',
        [pedidoId, item.articulo_id, item.cantidad]
      );

      await connection.query(
        'INSERT INTO pedido_items (pedido_id, articulo_id, cantidad) VALUES (?, ?, ?)',
        [pedidoId, item.articulo_id, item.cantidad]
      );

      await connection.query(
        'INSERT INTO detalle_pedido (pedido_id, articulo_id, cantidad) VALUES (?, ?, ?)',
        [pedidoId, item.articulo_id, item.cantidad]
      );
    }

    await connection.commit();

    // Enviar Correo de Confirmación con Factura Adjunta en formato PDF
    try {
      console.log(`[Email Despacho] Intentando enviar factura de pedido #${pedidoId} a: ${userRows[0].email}`);
      
      let pdfBuffer = null;
      try {
        pdfBuffer = await generatePDFBuffer(
          {
            id: pedidoId,
            fecha: new Date(),
            total: totalFinal,
            subtotal: subtotal,
            impuesto: impuesto,
            costo_envio: costoEnvio,
            tipo_entrega: selectedTipoEntrega,
            estado: 'Pendiente',
            cliente_nombre: userRows[0].nombre,
            cliente_email: userRows[0].email
          },
          processedItems
        );
        console.log(`[Email Despacho] PDF Invoice Buffer creado con éxito (${pdfBuffer.length} bytes).`);
      } catch (pdfErr) {
        console.error("[Email Despacho] Error crítico al crear el archivo PDF de la factura:", pdfErr);
      }

      if (pdfBuffer && userRows[0].email) {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
          }
        });

        try {
          const info = await transporter.sendMail({
            from: `"WMS Inventario" <${process.env.EMAIL_USER}>`,
            to: userRows[0].email,
            subject: `Factura de Compra - Pedido #${pedidoId}`,
            text: `Hola ${userRows[0].nombre},\n\nMuchas gracias por su compra. Adjunto a este correo encontrará el comprobante PDF oficial de su pedido #${pedidoId} por un monto total de ₡${totalFinal.toLocaleString('es-CR')}.\n\nDetalles del despacho:\n- Tipo de entrega: ${selectedTipoEntrega}\n- Estado inicial: Pendiente\n\nSaludos cordiales,\nEl equipo de WMS.`,
            attachments: [
              {
                filename: `Factura_Pedido_${pedidoId}.pdf`,
                content: pdfBuffer
              }
            ]
          });
          console.log(`[Email Despacho] Correo enviado exitosamente con Nodemailer: ${info.messageId}`);
        } catch (mailErr) {
          console.error("[Email Despacho] Fallo en Nodemailer al llamar a transporter.sendMail():", mailErr);
        }
      } else {
        console.warn("[Email Despacho] No se pudo enviar el correo debido a que no hay PDF generado o no se encontró el email del cliente.");
      }
    } catch (outerErr) {
      console.error("[Email Despacho] Error externo en bloque de correo adjunto:", outerErr);
    }

    return res.status(201).json({
      success: true,
      message: 'Pedido creado exitosamente',
      pedido_id: pedidoId,
      subtotal: subtotal,
      impuesto: impuesto,
      costo_envio: costoEnvio,
      total: totalFinal,
      moneda: '₡ (Colones)',
      detalles: processedItems
    });

  } catch (error) {
    await connection.rollback();
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }
    next(error);
  } finally {
    connection.release();
  }
};

// GET /api/v1/inventario/historial-cliente
exports.getHistorialCliente = async (req, res, next) => {
  const cliente_id = req.query.cliente_id || req.params.cliente_id;

  if (!cliente_id) {
    return res.status(400).json({
      success: false,
      message: 'El cliente_id es requerido'
    });
  }

  try {
    const [rows] = await pool.query(
      `SELECT id, cliente_id, subtotal, impuesto_iva, impuesto, total, 
              tipo_entrega, direccion_entrega, direccion_envio, telefono_contacto, 
              estado, fecha_creacion
       FROM pedidos
       WHERE cliente_id = ?
       ORDER BY fecha_creacion DESC`,
      [cliente_id]
    );

    // Mapeo amigable de los estados
    const formattedRows = rows.map(r => {
      let estadoAmigable = r.estado;
      if (r.estado === 'Alistando') estadoAmigable = 'En Alistado';
      if (r.estado === 'Listo para Despacho') estadoAmigable = 'Listo';

      return {
        ...r,
        estado_detalle: estadoAmigable
      };
    });

    return res.status(200).json({
      success: true,
      data: formattedRows
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/inventario/articulos
exports.getArticulos = async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT id, nombre, precio_base FROM articulos');
    return res.status(200).json({
      success: true,
      data: rows
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/inventario/pedidos/cliente/:cliente_id
exports.getPedidosCliente = async (req, res, next) => {
  const { cliente_id } = req.params;

  if (!cliente_id) {
    return res.status(400).json({
      success: false,
      message: 'El cliente_id es requerido'
    });
  }

  try {
    const [rows] = await pool.query(
      `SELECT id, cliente_id, subtotal, impuesto_iva, impuesto, total, 
              tipo_entrega, direccion_entrega, direccion_envio, telefono_contacto, 
              estado, fecha_creacion
       FROM pedidos
       WHERE cliente_id = ?
       ORDER BY fecha_creacion DESC`,
      [cliente_id]
    );

    for (const order of rows) {
      const [items] = await pool.query(
        `SELECT pi.articulo_id, a.nombre AS articulo, pi.cantidad 
         FROM pedido_items pi 
         JOIN articulos a ON pi.articulo_id = a.id 
         WHERE pi.pedido_id = ?`,
        [order.id]
      );
      order.items = items;
    }

    // Mapeo amigable de los estados
    const formattedRows = rows.map(r => {
      let estadoAmigable = r.estado;
      if (r.estado === 'Alistando') estadoAmigable = 'En Alistado';
      if (r.estado === 'Listo para Despacho') estadoAmigable = 'Listo';

      return {
        ...r,
        estado_detalle: estadoAmigable
      };
    });

    return res.status(200).json({
      success: true,
      data: formattedRows
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/inventario/pedidos-alistador
exports.getPedidosAlistador = async (req, res, next) => {
  try {
    const [orders] = await pool.query(
      `SELECT p.id, p.cliente_id, u.nombre AS cliente_nombre, u.telefono AS cliente_telefono, 
              p.subtotal, p.impuesto_iva, p.impuesto, p.total, p.tipo_entrega, p.direccion_entrega, 
              p.direccion_envio, p.telefono_contacto, p.estado, p.fecha_creacion 
       FROM pedidos p 
       JOIN usuarios u ON p.cliente_id = u.id 
       WHERE p.estado = 'Pendiente' 
       ORDER BY p.fecha_creacion DESC`
    );

    for (const order of orders) {
      const [items] = await pool.query(
        `SELECT pi.articulo_id, a.nombre AS articulo, pi.cantidad 
         FROM pedido_items pi 
         JOIN articulos a ON pi.articulo_id = a.id 
         WHERE pi.pedido_id = ?`,
        [order.id]
      );
      order.items = items;
    }

    return res.status(200).json({
      success: true,
      data: orders
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/inventario/completar-alistado
exports.completarAlistado = async (req, res, next) => {
  const { pedido_id, ubicacion_despacho } = req.body;

  if (!pedido_id) {
    return res.status(400).json({ success: false, message: 'ID de pedido es requerido' });
  }

  if (!ubicacion_despacho) {
    return res.status(400).json({ success: false, message: 'La ubicación de despacho es requerida' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Verificar si el pedido existe
    const [orders] = await connection.query('SELECT id, estado FROM pedidos WHERE id = ? FOR UPDATE', [pedido_id]);
    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    }

    const order = orders[0];
    if (order.estado !== 'Pendiente' && order.estado !== 'Alistando') {
      return res.status(400).json({ success: false, message: 'El pedido no está pendiente para ser alistado' });
    }

    // Actualizar estado a 'Listo' y registrar la ubicación física
    await connection.query(
      "UPDATE pedidos SET estado = 'Listo', ubicacion_despacho = ? WHERE id = ?",
      [ubicacion_despacho, pedido_id]
    );

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: `¡Alistado de Pedido #${pedido_id} completado con éxito! Colocado en: ${ubicacion_despacho}`,
      data: {
        pedido_id,
        estado: 'Listo',
        ubicacion_despacho
      }
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

// GET /api/v1/inventario/catalogo
exports.getCatalogo = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, nombre, precio_base, 
              (precio_base * 1.13) AS precio_con_iva,
              imagen_url
       FROM articulos`
    );

    return res.status(200).json({
      success: true,
      data: rows
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/inventario/movimientos
exports.getMovimientos = async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        m.id,
        m.articulo_id,
        m.usuario_id,
        m.tipo_movimiento,
        m.cantidad,
        m.posicion_origen,
        m.posicion_destino,
        m.fecha,
        m.detalle_dano,
        a.nombre AS articulo_nombre,
        u.nombre AS usuario_nombre
      FROM movimientos_inventario m
      JOIN articulos a ON m.articulo_id = a.id
      JOIN usuarios u ON m.usuario_id = u.id
      ORDER BY m.fecha DESC
    `);

    return res.status(200).json({
      success: true,
      data: rows
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/pedidos/:id/exportar-pdf
exports.exportarPDF = async (req, res, next) => {
  const { id } = req.params;

  const connection = await pool.getConnection();
  try {
    // 1. Fetch order details
    const [orders] = await connection.query(`
      SELECT 
        p.id,
        p.fecha_creacion AS fecha,
        p.total,
        p.subtotal,
        p.impuesto,
        p.tipo_entrega,
        p.direccion_entrega,
        p.estado,
        u_cli.nombre AS cliente_nombre,
        u_cli.email AS cliente_email,
        u_ali.nombre AS alistador_nombre
      FROM pedidos p
      LEFT JOIN usuarios u_cli ON p.cliente_id = u_cli.id
      LEFT JOIN usuarios u_ali ON p.alistador_id = u_ali.id
      WHERE p.id = ?
    `, [id]);

    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    }

    const order = orders[0];

    // 2. Fetch order items
    const [items] = await connection.query(`
      SELECT 
        pi.cantidad,
        a.nombre AS articulo_nombre,
        a.precio_base
      FROM pedido_items pi
      JOIN articulos a ON pi.articulo_id = a.id
      WHERE pi.pedido_id = ?
    `, [id]);

    // 3. Generate PDF
    const doc = new PDFDocument({ margin: 50 });

    // Set response headers for download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Comprobante_Despacho_${id}.pdf"`);

    // Stream PDF directly to response
    doc.pipe(res);

    // Styling helpers
    const formatColones = (num) => `¢${parseFloat(num || 0).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // --- Header ---
    doc.fillColor('#1C2541')
       .rect(0, 0, 612, 100) // Dark blue background header
       .fill();

    doc.fillColor('#FFFFFF')
       .fontSize(22)
       .text('WMS INVENTARIO', 50, 30, { align: 'left', wordBreak: false })
       .fontSize(10)
       .text('Sistema de Gestión de Almacén Oficial', 50, 58);

    doc.fontSize(12)
       .text('COMPROBANTE DE DESPACHO', 300, 30, { align: 'right' })
       .fontSize(14)
       .font('Helvetica-Bold')
       .text(`Pedido #${order.id}`, 300, 50, { align: 'right' })
       .font('Helvetica');

    doc.moveDown(4);

    // --- Order Info Box ---
    doc.fillColor('#000000');
    const startY = 130;
    
    // Left column info
    doc.fontSize(10).font('Helvetica-Bold').text('CLIENTE:', 50, startY);
    doc.font('Helvetica').text(`${order.cliente_nombre || 'Cliente General'}`, 130, startY);
    doc.fontSize(10).font('Helvetica-Bold').text('EMAIL:', 50, startY + 18);
    doc.font('Helvetica').text(`${order.cliente_email || '-'}`, 130, startY + 18);
    doc.fontSize(10).font('Helvetica-Bold').text('FECHA:', 50, startY + 36);
    doc.font('Helvetica').text(`${new Date(order.fecha).toLocaleString('es-CR')}`, 130, startY + 36);

    // Right column info
    doc.fontSize(10).font('Helvetica-Bold').text('ALISTADOR:', 320, startY);
    doc.font('Helvetica').text(`${order.alistador_nombre || 'Sin Asignar'}`, 410, startY);
    doc.fontSize(10).font('Helvetica-Bold').text('TIPO ENTREGA:', 320, startY + 18);
    doc.font('Helvetica').text(`${order.tipo_entrega || 'Sucursal'}`, 410, startY + 18);
    doc.fontSize(10).font('Helvetica-Bold').text('ESTADO:', 320, startY + 36);
    doc.font('Helvetica').text(`${order.estado || 'Entregado'}`, 410, startY + 36);

    // Draw horizontal separator line
    doc.strokeColor('#CCCCCC')
       .lineWidth(1)
       .moveTo(50, startY + 60)
       .lineTo(562, startY + 60)
       .stroke();

    // --- Articles Table ---
    let currentY = startY + 80;
    
    // Draw table header
    doc.fillColor('#F2F2F2')
       .rect(50, currentY, 512, 22)
       .fill();
    
    doc.fillColor('#1C2541')
       .font('Helvetica-Bold')
       .fontSize(9);

    doc.text('Artículo', 60, currentY + 6);
    doc.text('Cant.', 320, currentY + 6, { width: 50, align: 'center' });
    doc.text('Precio Unit.', 380, currentY + 6, { width: 80, align: 'right' });
    doc.text('Subtotal', 470, currentY + 6, { width: 80, align: 'right' });

    doc.font('Helvetica').fillColor('#333333');
    currentY += 22;

    items.forEach((item, index) => {
      // Background shading for alternate rows
      if (index % 2 === 1) {
        doc.fillColor('#FAFAFA')
           .rect(50, currentY, 512, 20)
           .fill();
      }

      const itemSubtotal = item.cantidad * item.precio_base;

      doc.fillColor('#333333')
         .text(item.articulo_nombre, 60, currentY + 5, { width: 250, height: 12, ellipsis: true });
      doc.text(item.cantidad.toString(), 320, currentY + 5, { width: 50, align: 'center' });
      doc.text(formatColones(item.precio_base), 380, currentY + 5, { width: 80, align: 'right' });
      doc.text(formatColones(itemSubtotal), 470, currentY + 5, { width: 80, align: 'right' });

      // Draw bottom row border
      doc.strokeColor('#E0E0E0')
         .lineWidth(0.5)
         .moveTo(50, currentY + 20)
         .lineTo(562, currentY + 20)
         .stroke();

      currentY += 20;
    });

    // --- Financial Summary Box ---
    currentY += 15;
    const summaryX = 350;

    doc.fillColor('#000000').font('Helvetica');
    doc.text('Monto Subtotal:', summaryX, currentY);
    doc.text(formatColones(order.subtotal), 470, currentY, { width: 80, align: 'right' });

    currentY += 16;
    doc.text('Impuesto (13% IVA):', summaryX, currentY);
    doc.text(formatColones(order.impuesto || (order.subtotal * 0.13)), 470, currentY, { width: 80, align: 'right' });

    currentY += 20;
    doc.font('Helvetica-Bold').fontSize(11).text('Total Neto:', summaryX, currentY);
    doc.text(formatColones(order.total), 470, currentY, { width: 80, align: 'right' });

    // --- Signature Section ---
    const sigY = 620;
    
    doc.strokeColor('#999999')
       .lineWidth(1)
       .moveTo(70, sigY)
       .lineTo(230, sigY)
       .moveTo(380, sigY)
       .lineTo(540, sigY)
       .stroke();

    doc.fillColor('#666666')
       .font('Helvetica')
       .fontSize(9);

    doc.text('Entregado por (Alistador/Despacho)', 70, sigY + 8, { width: 160, align: 'center' });
    doc.text('Recibido por (Firma Cliente)', 380, sigY + 8, { width: 160, align: 'center' });

    // End Document
    doc.end();

  } catch (error) {
    next(error);
  } finally {
    connection.release();
  }
};

exports.exportarMovimientoPDF = async (req, res, next) => {
  const { id } = req.params;

  const connection = await pool.getConnection();
  try {
    const [movements] = await connection.query(`
      SELECT 
        m.id,
        m.articulo_id,
        m.usuario_id,
        m.tipo_movimiento,
        m.cantidad,
        m.posicion_origen,
        m.posicion_destino,
        m.fecha,
        m.detalle_dano,
        a.nombre AS articulo_nombre,
        u.nombre AS usuario_nombre
      FROM movimientos_inventario m
      JOIN articulos a ON m.articulo_id = a.id
      JOIN usuarios u ON m.usuario_id = u.id
      WHERE m.id = ?
    `, [id]);

    if (movements.length === 0) {
      return res.status(404).json({ success: false, message: 'Movimiento no encontrado' });
    }

    const mov = movements[0];

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Comprobante_Ajuste_${id}.pdf"`);

    doc.pipe(res);

    // --- Header ---
    doc.fillColor('#1C2541')
       .rect(0, 0, 612, 100) // Dark blue background header
       .fill();

    doc.fillColor('#FFFFFF')
       .fontSize(22)
       .text('WMS INVENTARIO', 50, 30, { align: 'left', wordBreak: false })
       .fontSize(10)
       .text('Sistema de Gestión de Almacén Oficial', 50, 58);

    doc.fontSize(12)
       .text('COMPROBANTE DE AJUSTE DE INVENTARIO', 300, 30, { align: 'right' })
       .fontSize(14)
       .font('Helvetica-Bold')
       .text(`Movimiento #${mov.id}`, 300, 50, { align: 'right' })
       .font('Helvetica');

    doc.moveDown(4);

    // --- Details Box ---
    doc.fillColor('#000000');
    const startY = 130;

    // Left Column
    doc.fontSize(10).font('Helvetica-Bold').text('TIPO MOVIMIENTO:', 50, startY);
    doc.font('Helvetica').text(`${mov.tipo_movimiento}`, 160, startY);

    doc.fontSize(10).font('Helvetica-Bold').text('OPERARIO:', 50, startY + 18);
    doc.font('Helvetica').text(`${mov.usuario_nombre}`, 160, startY + 18);

    doc.fontSize(10).font('Helvetica-Bold').text('FECHA:', 50, startY + 36);
    doc.font('Helvetica').text(`${new Date(mov.fecha).toLocaleString('es-CR')}`, 160, startY + 36);

    // Right Column
    doc.fontSize(10).font('Helvetica-Bold').text('UBICACIÓN ORIGEN:', 320, startY);
    doc.font('Helvetica').text(`${mov.posicion_origen || '-'}`, 440, startY);

    doc.fontSize(10).font('Helvetica-Bold').text('UBICACIÓN DESTINO:', 320, startY + 18);
    doc.font('Helvetica').text(`${mov.posicion_destino || '-'}`, 440, startY + 18);

    // Draw separator line
    doc.strokeColor('#CCCCCC')
       .lineWidth(1)
       .moveTo(50, startY + 60)
       .lineTo(562, startY + 60)
       .stroke();

    // --- Article Details ---
    let currentY = startY + 80;

    // Draw a box header for article info
    doc.fillColor('#F2F2F2')
       .rect(50, currentY, 512, 22)
       .fill();

    doc.fillColor('#1C2541')
       .font('Helvetica-Bold')
       .fontSize(10);

    doc.text('Artículo Afectado', 60, currentY + 6);
    doc.text('Cantidad Ajustada', 420, currentY + 6, { width: 130, align: 'right' });

    doc.font('Helvetica').fillColor('#333333');
    currentY += 22;

    // Item row
    doc.text(mov.articulo_nombre, 60, currentY + 8, { width: 340 });
    doc.font('Helvetica-Bold')
       .text(`${mov.cantidad} Uds`, 420, currentY + 8, { width: 130, align: 'right' });

    doc.strokeColor('#E0E0E0')
       .lineWidth(0.5)
       .moveTo(50, currentY + 24)
       .lineTo(562, currentY + 24)
       .stroke();

    currentY += 40;

    // --- Damage / Detail Section ---
    if (mov.tipo_movimiento === 'AJUSTE' || mov.detalle_dano) {
      doc.fillColor('#FDF0F0')
         .rect(50, currentY, 512, 60)
         .fill();

      doc.strokeColor('#FFD2D2')
         .lineWidth(1)
         .rect(50, currentY, 512, 60)
         .stroke();

      doc.fillColor('#D62828')
         .font('Helvetica-Bold')
         .fontSize(10)
         .text('DETALLE DEL DAÑO / OBSERVACIONES:', 60, currentY + 10);

      doc.fillColor('#333333')
         .font('Helvetica')
         .fontSize(9.5)
         .text(mov.detalle_dano || 'No se especificaron detalles del daño.', 60, currentY + 24, { width: 490 });
    } else {
      // General detail if present
      doc.fillColor('#F7F7F7')
         .rect(50, currentY, 512, 50)
         .fill();

      doc.strokeColor('#E0E0E0')
         .lineWidth(1)
         .rect(50, currentY, 512, 50)
         .stroke();

      doc.fillColor('#1C2541')
         .font('Helvetica-Bold')
         .fontSize(10)
         .text('DETALLE / OBSERVACIONES DE AJUSTE:', 60, currentY + 10);

      doc.fillColor('#333333')
         .font('Helvetica')
         .fontSize(9.5)
         .text(mov.detalle_dano || 'Ajuste general de stock.', 60, currentY + 24, { width: 490 });
    }

    // --- Signature Section ---
    const sigY = 620;

    doc.strokeColor('#999999')
       .lineWidth(1)
       .moveTo(70, sigY)
       .lineTo(230, sigY)
       .moveTo(380, sigY)
       .lineTo(540, sigY)
       .stroke();

    doc.fillColor('#666666')
       .font('Helvetica')
       .fontSize(9);

    doc.text('Operario Responsable', 70, sigY + 8, { width: 160, align: 'center' });
    doc.text('Firma Autorizada WMS', 380, sigY + 8, { width: 160, align: 'center' });

    doc.end();

  } catch (error) {
    next(error);
  } finally {
    connection.release();
  }
};