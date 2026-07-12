# WMS Inventario - Sistema de Gestión de Bodega (UCEM)

Este proyecto es un sistema de gestión de inventarios y bodega (WMS - Warehouse Management System) enfocado al mercado de Costa Rica (precios en Colones costarricenses ₡ e IVA del 13%). Está desarrollado como una aplicación full-stack con un backend en **Node.js + Express + MySQL** y un frontend desarrollado en **React Native / Expo** para entorno web y móvil.

---

## 👥 Roles del Sistema

El sistema cuenta con 3 flujos y roles de usuario completamente diferenciados:

1. **Cliente / Comprador:**
   * Visualización del catálogo estético de productos en modo oscuro con imágenes reales y precios con IVA.
   * Compra de artículos con carrito interactivo, cálculo automático del 13% de IVA y selección de método de entrega (*Express* con dirección de envío u *Retiro en Sucursal*).
   * Historial de pedidos detallado indicando exactamente qué artículos compró y en qué cantidades.
2. **Alistador (Bodega):**
   * Panel de despacho donde recibe las solicitudes de pedidos pendientes.
   * Lista de chequeo interactiva para retirar físicamente los artículos del piso de alisto.
   * Ubicación automatizada de despacho que le indica al alistador en qué zona física debe depositar el pedido listo (*Lugar 1 para Express* o *Lugar 2 para Sucursal*).
3. **Operador de Inventario / Montacarguista:**
   * Mapa tridimensional y mapa plano de la distribución física de racks en la bodega.
   * Gestión y rebalanceo de stock entre ubicaciones de **Alisto** (Pisos 1, 2, 3) y **Altura** (Pisos 4, 5).
   * Solicitud automatizada de reabastecimiento desde las alturas a los pisos inferiores cuando hay rotura de stock.

---

## 🛠️ Requisitos Previos

Antes de ejecutar el proyecto, asegúrate de tener instalado en tu máquina:
* **Node.js** (versión 18 o superior recomendada)
* **npm** (incluido con Node)
* **MySQL Server** o **MariaDB** (por ejemplo, a través de XAMPP, WampServer o standalone)
* **Expo CLI** (instalado automáticamente como dependencia local del frontend)

---

## 🚀 Pasos de Instalación y Ejecución

### 1. Clonar el repositorio
Abre tu consola y ejecuta:
```bash
git clone <URL_DE_ESTE_REPOSITORIO>
cd wms_inventario
```

### 2. Configurar la Base de Datos MySQL
1. Abre tu gestor de base de datos MySQL (por ejemplo phpMyAdmin, DBeaver, MySQL Workbench o consola).
2. Importa el archivo `schema.sql` ubicado en la raíz de este proyecto. Este script:
   * Creará la base de datos `wms_inventario` si no existe.
   * Estructurará todas las tablas necesarias con llaves foráneas y triggers.
   * Insertará los roles, los usuarios por defecto con contraseñas seguras y el catálogo de 10 herramientas con precios reales en Colones y sus imágenes oficiales.

### 3. Configurar y levantar el Backend (`wms_backend`)
1. Ve al directorio del backend:
   ```bash
   cd wms_backend
   ```
2. Instala las dependencias necesarias:
   ```bash
   npm install
   ```
3. Configura las variables de conexión en el archivo `.env` (si deseas cambiar el usuario o contraseña por defecto de MySQL):
   ```env
   PORT=3000
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=wms_inventario
   ```
4. Inicia el servidor de backend:
   ```bash
   npm start
   ```
   El backend se levantará en el puerto `3000` (`http://localhost:3000`).

### 4. Configurar y levantar el Frontend (`wms_frontend`)
1. Abre una nueva pestaña de la consola y ve al directorio del frontend:
   ```bash
   cd wms_frontend
   ```
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Inicia la aplicación de Expo en modo web:
   ```bash
   npm run web
   ```
   La aplicación se compilará y se abrirá automáticamente en tu navegador web en `http://localhost:8081`.

---

## 🔐 Credenciales de Prueba por Defecto

Puedes iniciar sesión en la aplicación utilizando cualquiera de las siguientes cuentas:

| Rol | Correo Electrónico | Contraseña |
| :--- | :--- | :--- |
| **Operador de Inventario** | `juanp@gmail.com` | `Password1*` |
| **Alistador (Bodega)** | `manuelu@gmail.com` | `Password4*` |
| **Cliente / Comprador** | `fannyq@gmail.com` | `Password8*` |
| **Montacarguista** | `michaels@gmail.com` | `Password3*` |
| **Administrador** | `erickp@gmail.com` | `Password12*` |
