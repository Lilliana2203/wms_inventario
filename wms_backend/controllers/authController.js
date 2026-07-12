const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const pool = require('../db');

// In-memory store for reset tokens (email -> { token, expires })
const resetTokens = new Map();

exports.login = async (req, res, next) => {
  const { email, password } = req.body;
  console.log("Datos recibidos en login:", email, password);

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'El correo electrónico y la contraseña son requeridos'
    });
  }

  try {
    // Agregamos "AND activo = 1" para que usuarios desactivados no puedan entrar
    const query = 'SELECT * FROM usuarios WHERE email = ? AND (activo = 1 OR activo IS NULL)';
    const result = await pool.query(query, [email.trim().toLowerCase()]);
    const rows = Array.isArray(result[0]) ? result[0] : result;

    if (!rows || rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales de inicio de sesión incorrectas o usuario inactivo'
      });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales de inicio de sesión incorrectas o usuario inactivo'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Inicio de sesión exitoso',
      data: {
        user: {
          id: user.id,
          nombre: user.nombre,
          email: user.email,
          rol_id: user.rol_id
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/auth/register-cliente
exports.registerCliente = async (req, res, next) => {
  const { nombre, email, password } = req.body;

  if (!nombre || !email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Todos los campos (nombre, email, password) son requeridos'
    });
  }

  try {
    const existingResult = await pool.query('SELECT id FROM usuarios WHERE email = ?', [email.trim().toLowerCase()]);
    const existing = Array.isArray(existingResult[0]) ? existingResult[0] : existingResult;

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'El correo electrónico ingresado ya se encuentra registrado'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const insertQuery = `
      INSERT INTO usuarios (nombre, email, password, rol_id, activo)
      VALUES (?, ?, ?, 1, 1)
    `;
    const [result] = await pool.query(insertQuery, [nombre.trim(), email.trim().toLowerCase(), hashedPassword]);

    return res.status(201).json({
      success: true,
      message: 'Registro de cliente exitoso',
      data: {
        user: {
          id: result.insertId,
          nombre: nombre.trim(),
          email: email.trim().toLowerCase(),
          rol_id: 1
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// ========================================================
// NUEVA FUNCIÓN: ¡El botón Eliminar (Borrado Lógico)!
// ========================================================
exports.eliminarUsuario = async (req, res, next) => {
  const { id } = req.params; // Captura el ID desde la URL de React (ej: /api/v1/auth/usuarios/5)

  try {
    // En lugar de DELETE (que falla por claves foráneas), hacemos un UPDATE de estado
    const query = 'UPDATE usuarios SET activo = 0 WHERE id = ?';
    const [result] = await pool.query(query, [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'No se encontró el usuario que deseas eliminar'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Usuario eliminado (desactivado) con éxito del sistema'
    });
  } catch (error) {
    console.error("Error al eliminar usuario:", error);
    next(error);
  }
};

// POST /api/auth/recuperar or /api/v1/auth/recuperar
exports.recuperarContrasena = async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'El correo electrónico es requerido'
    });
  }

  try {
    const query = 'SELECT id, nombre FROM usuarios WHERE email = ? AND (activo = 1 OR activo IS NULL)';
    const result = await pool.query(query, [email.trim().toLowerCase()]);
    const rows = Array.isArray(result[0]) ? result[0] : result;

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No existe un usuario activo con ese correo electrónico'
      });
    }

    const user = rows[0];
    const dummyToken = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Guardar token en memoria por 15 minutos
    resetTokens.set(email.trim().toLowerCase(), {
      token: dummyToken,
      expires: Date.now() + 15 * 60 * 1000
    });
    
    console.log(`\n======================================================`);
    console.log(`[RESTAURACIÓN DE CONTRASEÑA SOLICITADA]`);
    console.log(`Para: ${user.nombre} (${email})`);
    console.log(`Token temporal generado: ${dummyToken}`);
    console.log(`======================================================\n`);

    const emailUser = (process.env.EMAIL_USER || '').trim();
    const emailPass = (process.env.EMAIL_PASS || '').replace(/\s+/g, '').trim();

    console.log("DEBUG: EMAIL_USER loaded:", emailUser);
    console.log("DEBUG: EMAIL_PASS loaded length:", emailPass.length);
    console.log("DEBUG: Raw process.env.EMAIL_PASS:", process.env.EMAIL_PASS);

    // Configure Nodemailer transporter with user requirements
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: emailPass
      }
    });

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: #f4f5f7;
          color: #333333;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 30px auto;
          background-color: #ffffff;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 10px rgba(0,0,0,0.05);
          border: 1px solid #e1e4e8;
        }
        .header {
          background-color: #0b132b;
          padding: 30px;
          text-align: center;
        }
        .logo-badge {
          display: inline-block;
          background-color: #3a86c8;
          color: #ffffff;
          font-weight: bold;
          font-size: 20px;
          padding: 8px 20px;
          border-radius: 6px;
          letter-spacing: 1px;
        }
        .content {
          padding: 40px 30px;
        }
        .title {
          font-size: 22px;
          font-weight: bold;
          color: #0b132b;
          margin-bottom: 20px;
        }
        .text {
          font-size: 15px;
          line-height: 1.6;
          color: #5c6b73;
          margin-bottom: 30px;
        }
        .token-box {
          background-color: #f4f5f7;
          border: 1px dashed #3a86c8;
          border-radius: 8px;
          padding: 20px;
          text-align: center;
          margin-bottom: 30px;
        }
        .token-label {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          color: #3a86c8;
          margin-bottom: 8px;
          font-weight: bold;
        }
        .token-value {
          font-size: 32px;
          font-weight: bold;
          color: #0b132b;
          letter-spacing: 4px;
        }
        .footer {
          background-color: #f4f5f7;
          padding: 20px;
          text-align: center;
          font-size: 12px;
          color: #999999;
          border-top: 1px solid #e1e4e8;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo-badge">WMS INVENTARIO</div>
        </div>
        <div class="content">
          <div class="title">Recuperación de Contraseña</div>
          <div class="text">
            Hola <strong>${user.nombre}</strong>,<br><br>
            Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en el sistema de gestión de inventarios <strong>WMS</strong>. Utiliza el siguiente código de verificación temporal para completar el proceso:
          </div>
          <div class="token-box">
            <div class="token-label">Código de Verificación</div>
            <div class="token-value">${dummyToken}</div>
          </div>
          <div class="text" style="font-size: 13px; color: #999999; margin-bottom: 0;">
            * Este código es de un solo uso. Si tú no solicitaste este cambio, puedes ignorar este correo de forma segura.
          </div>
        </div>
        <div class="footer">
          WMS Inventarios © 2026 | Sistema de Gestión Oficial
        </div>
      </div>
    </body>
    </html>
    `;

    // Send the email
    await transporter.sendMail({
      from: `"WMS Inventario" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Restauración de Contraseña - WMS",
      text: `Hola ${user.nombre}, utiliza el siguiente token para recuperar tu contraseña: ${dummyToken}`,
      html: htmlContent
    });

    return res.status(200).json({
      success: true,
      message: `El token de restauración ha sido enviado a ${email}.`,
      data: {
        tokenSimulado: dummyToken
      }
    });
  } catch (error) {
    console.error("Error detallado de Nodemailer:", error);
    return res.status(500).json({
      success: false,
      message: `Error SMTP: ${error.message || error.code || 'Error desconocido'}`
    });
  }
};

// POST /api/auth/restablecer or /api/v1/auth/restablecer
exports.restablecerContrasena = async (req, res, next) => {
  const { email, token, newPassword } = req.body;

  if (!email || !token || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Todos los campos (email, token, newPassword) son requeridos'
    });
  }

  try {
    const data = resetTokens.get(email.trim().toLowerCase());

    if (!data || data.token !== token.trim().toUpperCase() || data.expires < Date.now()) {
      return res.status(400).json({
        success: false,
        message: 'Token de validación inválido o expirado'
      });
    }

    // Hash the new password with bcrypt
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update in Database
    const query = 'UPDATE usuarios SET password = ? WHERE email = ?';
    await pool.query(query, [hashedPassword, email.trim().toLowerCase()]);

    // Delete token from memory store
    resetTokens.delete(email.trim().toLowerCase());

    return res.status(200).json({
      success: true,
      message: 'Contraseña actualizada con éxito'
    });
  } catch (error) {
    console.error("Error al restablecer contraseña:", error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al actualizar la contraseña'
    });
  }
};