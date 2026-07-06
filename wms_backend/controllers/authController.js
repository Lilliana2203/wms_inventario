const bcrypt = require('bcryptjs');
const pool = require('../db');

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