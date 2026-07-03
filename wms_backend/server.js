const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authController = require('./controllers/authController');
const inventarioController = require('./controllers/inventarioController');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
// 1. Autenticación
app.post('/api/v1/auth/login', authController.login);
app.post('/api/v1/auth/register-cliente', authController.registerCliente);

// 2. Consulta de Inventario
app.get('/api/v1/inventario/racks', inventarioController.getRacks);

// 3. Acciones Transaccionales de Inventario
app.post('/api/v1/inventario/comprar', inventarioController.comprar);
app.post('/api/v1/inventario/crear-pedido', inventarioController.crearPedidoCliente);
app.get('/api/v1/inventario/historial-cliente', inventarioController.getHistorialCliente);
app.get('/api/v1/inventario/articulos', inventarioController.getArticulos);
app.get('/api/v1/inventario/catalogo', inventarioController.getCatalogo);
app.get('/api/v1/inventario/pedidos/cliente/:cliente_id', inventarioController.getPedidosCliente);
app.get('/api/v1/inventario/pedidos-alistador', inventarioController.getPedidosAlistador);
app.post('/api/v1/inventario/completar-alistado', inventarioController.completarAlistado);
app.post('/api/v1/inventario/reabastecer', inventarioController.reabastecer);
app.post('/api/v1/inventario/despachar', inventarioController.despachar);
app.post('/api/v1/inventario/ajuste-dano', inventarioController.ajusteDano);
app.post('/api/v1/inventario/solicitar-reabastecimiento', inventarioController.solicitarReabastecimiento);
app.get('/api/v1/inventario/tareas-pendientes', inventarioController.getTareasPendientes);
app.post('/api/v1/inventario/incrementar-stock', inventarioController.incrementarStock);
app.get('/api/v1/inventario/pedidos-pendientes', inventarioController.getPedidosPendientes);
app.post('/api/v1/inventario/solicitar-abasto-inventario', inventarioController.solicitarAbastoInventario);
app.get('/api/v1/inventario/solicitudes-abasto', inventarioController.getSolicitudesAbasto);
app.post('/api/v1/inventario/compra-abastecimiento', inventarioController.compraAbastecimiento);

// 4. Módulo de Administración (Solo Rol 5)
app.get('/api/v1/admin/usuarios', inventarioController.getUsuarios);
app.post('/api/v1/admin/crear-usuario', inventarioController.crearUsuario);
app.get('/api/v1/admin/pedidos-global', inventarioController.getPedidosGlobal);

// CORRECCIÓN AQUÍ: Apuntan a inventarioController.eliminarUsuario con borrado lógico seguro
app.delete('/api/v1/admin/usuarios/:id', inventarioController.eliminarUsuario);
app.delete('/api/usuarios/:id', inventarioController.eliminarUsuario);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err);
  res.status(500).json({
    success: false,
    message: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Servidor WMS corriendo en el puerto ${PORT}`);
});