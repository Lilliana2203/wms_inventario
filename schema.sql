-- =======================================================
-- UCEM - WMS Inventario Database Schema & Seeder Script
-- Generated automatically for project delivery
-- =======================================================

CREATE DATABASE IF NOT EXISTS `wms_inventario` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE `wms_inventario`;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `roles`;
DROP TABLE IF EXISTS `usuarios`;
DROP TABLE IF EXISTS `articulos`;
DROP TABLE IF EXISTS `posiciones_rack`;
DROP TABLE IF EXISTS `pedidos`;
DROP TABLE IF EXISTS `pedido_detalles`;

CREATE TABLE `roles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(50) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `usuarios` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `rol_id` int(11) DEFAULT NULL,
  `telefono` varchar(15) DEFAULT '8888-8888',
  `activo` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `rol_id` (`rol_id`),
  CONSTRAINT `usuarios_ibfk_1` FOREIGN KEY (`rol_id`) REFERENCES `roles` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `articulos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `max_altura` int(11) NOT NULL,
  `max_alisto` int(11) NOT NULL,
  `precio_base` decimal(10,2) DEFAULT 0.00,
  `imagen_url` varchar(1000) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `posiciones_rack` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `rack_nombre` varchar(10) NOT NULL,
  `piso` int(11) NOT NULL CHECK (`piso` between 1 and 5),
  `tipo` enum('Alisto','Altura') NOT NULL,
  `articulo_id` int(11) DEFAULT NULL,
  `cantidad_actual` int(11) DEFAULT 0,
  `posicion_especifica` varchar(50) DEFAULT 'Posición 1',
  PRIMARY KEY (`id`),
  KEY `articulo_id` (`articulo_id`),
  CONSTRAINT `posiciones_rack_ibfk_1` FOREIGN KEY (`articulo_id`) REFERENCES `articulos` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=52 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `pedidos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `cliente_id` int(11) DEFAULT NULL,
  `alistador_id` int(11) DEFAULT NULL,
  `subtotal` decimal(12,2) NOT NULL DEFAULT 0.00,
  `impuesto_iva` decimal(10,2) DEFAULT NULL,
  `total` decimal(10,2) DEFAULT NULL,
  `tipo_entrega` enum('Express','Retiro en Lugar','express','sucursal') NOT NULL DEFAULT 'sucursal',
  `direccion_entrega` text DEFAULT NULL,
  `estado` enum('Pendiente','Alistando','Listo para Despacho','Listo','Entregado') DEFAULT 'Pendiente',
  `zona_despacho` enum('Lugar 1 de Despacho','Lugar 2 de Recolecta') DEFAULT NULL,
  `fecha_creacion` timestamp NOT NULL DEFAULT current_timestamp(),
  `telefono_contacto` varchar(20) DEFAULT NULL,
  `direccion_envio` text DEFAULT NULL,
  `impuesto` decimal(12,2) NOT NULL DEFAULT 0.00,
  `ubicacion_despacho` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `cliente_id` (`cliente_id`),
  KEY `alistador_id` (`alistador_id`),
  CONSTRAINT `pedidos_ibfk_1` FOREIGN KEY (`cliente_id`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `pedidos_ibfk_2` FOREIGN KEY (`alistador_id`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `pedido_detalles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `pedido_id` int(11) NOT NULL,
  `articulo_id` int(11) NOT NULL,
  `cantidad` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `pedido_id` (`pedido_id`),
  KEY `articulo_id` (`articulo_id`),
  CONSTRAINT `pedido_detalles_ibfk_1` FOREIGN KEY (`pedido_id`) REFERENCES `pedidos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `pedido_detalles_ibfk_2` FOREIGN KEY (`articulo_id`) REFERENCES `articulos` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- =======================================================
-- SEEDING ROLES
-- =======================================================
INSERT INTO `roles` (`id`, `nombre`) VALUES (5, 'Administrador');
INSERT INTO `roles` (`id`, `nombre`) VALUES (2, 'Alistador');
INSERT INTO `roles` (`id`, `nombre`) VALUES (1, 'Comprador');
INSERT INTO `roles` (`id`, `nombre`) VALUES (4, 'Inventario');
INSERT INTO `roles` (`id`, `nombre`) VALUES (3, 'Montacarguista');

-- =======================================================
-- SEEDING USUARIOS (Passwords Bcrypt encrypted)
-- =======================================================
INSERT INTO `usuarios` (`id`, `nombre`, `email`, `password`, `rol_id`) VALUES (1, 'Juan Perez', 'juanp@gmail.com', '$2b$10$H5bp0g0y4.vX.WGtElUB4u0RH7Q71A6IxSCbmo6OWVObQXcAM56x.', 4);
INSERT INTO `usuarios` (`id`, `nombre`, `email`, `password`, `rol_id`) VALUES (2, 'Melisaa Porras', 'melissap@gmail.com', '$2b$10$IsqoIMwxKG9CIG8jwZQyuODbAoN2bwyld3x0rfURRTGU54sZFpNYi', 4);
INSERT INTO `usuarios` (`id`, `nombre`, `email`, `password`, `rol_id`) VALUES (3, 'Michael Salas', 'michaels@gmail.com', '$2b$10$NzmQB7VQoIM0d/63U55mDu.q0VJHH6DHM4ptmcX8DeqUNjdrytu7.', 3);
INSERT INTO `usuarios` (`id`, `nombre`, `email`, `password`, `rol_id`) VALUES (4, 'Manuel Ugarte', 'manuelu@gmail.com', '$2b$10$eKKeLRxBETo4K.hhJjc7vuv0Sh4KQpCX5WpzY29lYuR3L7AqSeNyu', 2);
INSERT INTO `usuarios` (`id`, `nombre`, `email`, `password`, `rol_id`) VALUES (5, 'Sandra Lopez', 'sandral@gmail.com', '$2b$10$qNOfNJPWYUJV1kQVXik6lenSHzLqvPMY4RPV6qF1qcnnIYVtZ6n7e', 2);
INSERT INTO `usuarios` (`id`, `nombre`, `email`, `password`, `rol_id`) VALUES (6, 'Jordan Carvajal', 'jordanc@gmail.com', '$2b$10$5LLEb4lFu6ZTfKwjCYyo6u1FK3mVHOFpbp4ovozaE44UhhdSd.MoS', 2);
INSERT INTO `usuarios` (`id`, `nombre`, `email`, `password`, `rol_id`) VALUES (7, 'Susana Lopez', 'susanal@gmail.com', '$2b$10$Gu2rqnhaxSFPI.8.QbO1wuhpIuy1HRmwc3Ah8t0p/7AruR47d87Sa', 1);
INSERT INTO `usuarios` (`id`, `nombre`, `email`, `password`, `rol_id`) VALUES (8, 'Fanny Quesada', 'fannyq@gmail.com', '$2b$10$N3Zy4K4Nh3UVvbpZp92wTOO07CwqCskoNHDJcZvSvvSQGgJ8/muX6', 1);
INSERT INTO `usuarios` (`id`, `nombre`, `email`, `password`, `rol_id`) VALUES (9, 'Hector Madrigal', 'hectorm@gmail.com', '$2b$10$RPRLWnurHzcwxX26hcf6cuV/9TegE5gIDEi6wOZwdoaYU6Q7e92lO', 1);
INSERT INTO `usuarios` (`id`, `nombre`, `email`, `password`, `rol_id`) VALUES (10, 'Marco Ulate', 'marcou@gmail.com', '$2b$10$MDS/TC4hExjcidc0sjglNeddW/BoIhDxNx3ieJcI5HBB.vsnue26y', 1);
INSERT INTO `usuarios` (`id`, `nombre`, `email`, `password`, `rol_id`) VALUES (11, 'Prueba Cliente', 'pruebac@gmail.com', '$2b$10$zWKdW3aCXzx8H32BZkp7LeUI9FICIYo3D6wfeZUuIe9vW.lVCq5qW', 1);
INSERT INTO `usuarios` (`id`, `nombre`, `email`, `password`, `rol_id`) VALUES (12, 'Erick Petro', 'erickp@gmail.com', '$2b$10$abvg9clOmPKBFGNi3sDIdOvgN3jUAXGIXe9MfaMTq83pdEM/ceGsa', 5);

-- =======================================================
-- SEEDING ARTICULOS (Corrigiendo precios e imagen_url)
-- =======================================================
INSERT INTO `articulos` (`id`, `nombre`, `precio_base`, `imagen_url`) VALUES (1, 'Taladros DeWalt 20V Max', 45000.00, 'https://media.istockphoto.com/id/2262913015/photo/yellow-dewalt-cordless-drill-or-rutary-hammer-isolated-on-white-background-for-construction.jpg?s=2048x2048&w=is&k=20&c=4AQb3BJbGhvLLMB15m-6yygsNYTERnO4UUoDXY-QrBM=');
INSERT INTO `articulos` (`id`, `nombre`, `precio_base`, `imagen_url`) VALUES (2, 'Servicios Sanitarios American Standard', 85000.00, 'https://images.unsplash.com/photo-1587527901949-ab0341697c1e?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D');
INSERT INTO `articulos` (`id`, `nombre`, `precio_base`, `imagen_url`) VALUES (3, 'Sierra Circular Makita 7-1/4', 55000.00, 'https://media.istockphoto.com/id/116489993/photo/powerful-hand-held-circular-saw-tool.jpg?s=2048x2048&w=is&k=20&c=yn0-WuItjWNpSdduF3dBQYOQSdjNkdOttXLFWZGZMYg=');
INSERT INTO `articulos` (`id`, `nombre`, `precio_base`, `imagen_url`) VALUES (4, 'Puertas de Madera KanForm', 45000.00, 'https://media.istockphoto.com/id/871381408/photo/collection-of-different-wooden-doors-isolated-on-white.jpg?s=2048x2048&w=is&k=20&c=vMnLLsD6i5kk9ap-pet6Ruoy21_5JkloYEPWVRj8kP8=');
INSERT INTO `articulos` (`id`, `nombre`, `precio_base`, `imagen_url`) VALUES (5, 'Martillo de Impacto Bosch Professional', 120000.00, 'https://www.shutterstock.com/shutterstock/photos/2284514547/display_1500/stock-photo-kaunas-lithuania-march-professional-electric-bosch-brand-tools-for-sale-in-kaunas-2284514547.jpg');
INSERT INTO `articulos` (`id`, `nombre`, `precio_base`, `imagen_url`) VALUES (6, 'Caja de herramientas Stanley de 19 pulgadas', 18500.00, 'https://www.shutterstock.com/shutterstock/photos/2499374731/display_1500/stock-photo-yellow-black-toolbox-tools-kit-case-detail-close-up-on-the-ground-instruments-set-of-hand-tools-2499374731.jpg');
INSERT INTO `articulos` (`id`, `nombre`, `precio_base`, `imagen_url`) VALUES (7, 'Ventiladores Industriales Lasko 20', 120000.00, 'https://media.istockphoto.com/id/494208619/photo/water-damaged-kitchen-cabinets.jpg?s=2048x2048&w=is&k=20&c=sXe3oo3nHStpKN2Q1Bj9PNVjfJbNb-MS7sWYSX21afQ=');
INSERT INTO `articulos` (`id`, `nombre`, `precio_base`, `imagen_url`) VALUES (8, 'Caladoras Black+Decker de Velocidad Variable', 35000.00, 'https://media.istockphoto.com/id/536078915/photo/electric-plane-and-fret-saw.jpg?s=2048x2048&w=is&k=20&c=SThu2pfHJ-vok84-Sm-tQ57qXgiAyMxF1K5KvOfEzi8=');
INSERT INTO `articulos` (`id`, `nombre`, `precio_base`, `imagen_url`) VALUES (9, 'Esmeril Angular Milwaukee de 4-1/2', 65000.00, 'https://www.shutterstock.com/shutterstock/photos/1785544136/display_1500/stock-photo-children-s-angular-grinding-machine-plastic-hand-tool-toy-on-a-white-background-1785544136.jpg');
INSERT INTO `articulos` (`id`, `nombre`, `precio_base`, `imagen_url`) VALUES (10, 'Lijadora Orbital Truper de 5 pulgadas', 28000.00, 'https://www.shutterstock.com/shutterstock/photos/2530273677/display_1500/stock-photo--manual-electric-sanding-machine-isolated-on-white-background-2530273677.jpg');

-- =======================================================
-- SEEDING POSICIONES RACKS (Distribución balanceada)
-- =======================================================
INSERT INTO `posiciones_rack` (`id`, `rack_nombre`, `piso`, `tipo`, `cantidad_actual`, `posicion_especifica`, `articulo_id`) VALUES (32, 'Rack A', 1, 'Alisto', 8, 'Posición 1', 1);
INSERT INTO `posiciones_rack` (`id`, `rack_nombre`, `piso`, `tipo`, `cantidad_actual`, `posicion_especifica`, `articulo_id`) VALUES (33, 'Rack A', 4, 'Altura', 64, 'Posición 1', 1);
INSERT INTO `posiciones_rack` (`id`, `rack_nombre`, `piso`, `tipo`, `cantidad_actual`, `posicion_especifica`, `articulo_id`) VALUES (34, 'Rack A', 2, 'Alisto', 6, 'Posición 1', 2);
INSERT INTO `posiciones_rack` (`id`, `rack_nombre`, `piso`, `tipo`, `cantidad_actual`, `posicion_especifica`, `articulo_id`) VALUES (35, 'Rack A', 4, 'Altura', 10, 'Posición 1', 2);
INSERT INTO `posiciones_rack` (`id`, `rack_nombre`, `piso`, `tipo`, `cantidad_actual`, `posicion_especifica`, `articulo_id`) VALUES (36, 'Rack A', 3, 'Alisto', 10, 'Posición 1', 3);
INSERT INTO `posiciones_rack` (`id`, `rack_nombre`, `piso`, `tipo`, `cantidad_actual`, `posicion_especifica`, `articulo_id`) VALUES (37, 'Rack A', 5, 'Altura', 30, 'Posición 1', 3);
INSERT INTO `posiciones_rack` (`id`, `rack_nombre`, `piso`, `tipo`, `cantidad_actual`, `posicion_especifica`, `articulo_id`) VALUES (38, 'Rack A', 1, 'Alisto', 8, 'Posición 2', 4);
INSERT INTO `posiciones_rack` (`id`, `rack_nombre`, `piso`, `tipo`, `cantidad_actual`, `posicion_especifica`, `articulo_id`) VALUES (39, 'Rack A', 5, 'Altura', 24, 'Posición 1', 4);
INSERT INTO `posiciones_rack` (`id`, `rack_nombre`, `piso`, `tipo`, `cantidad_actual`, `posicion_especifica`, `articulo_id`) VALUES (40, 'Rack B', 1, 'Alisto', 12, 'Posición 1', 5);
INSERT INTO `posiciones_rack` (`id`, `rack_nombre`, `piso`, `tipo`, `cantidad_actual`, `posicion_especifica`, `articulo_id`) VALUES (41, 'Rack B', 4, 'Altura', 55, 'Posición 1', 5);
INSERT INTO `posiciones_rack` (`id`, `rack_nombre`, `piso`, `tipo`, `cantidad_actual`, `posicion_especifica`, `articulo_id`) VALUES (42, 'Rack B', 2, 'Alisto', 10, 'Posición 1', 6);
INSERT INTO `posiciones_rack` (`id`, `rack_nombre`, `piso`, `tipo`, `cantidad_actual`, `posicion_especifica`, `articulo_id`) VALUES (43, 'Rack B', 4, 'Altura', 30, 'Posición 1', 6);
INSERT INTO `posiciones_rack` (`id`, `rack_nombre`, `piso`, `tipo`, `cantidad_actual`, `posicion_especifica`, `articulo_id`) VALUES (44, 'Rack B', 3, 'Alisto', 15, 'Posición 1', 7);
INSERT INTO `posiciones_rack` (`id`, `rack_nombre`, `piso`, `tipo`, `cantidad_actual`, `posicion_especifica`, `articulo_id`) VALUES (45, 'Rack B', 5, 'Altura', 64, 'Posición 1', 7);
INSERT INTO `posiciones_rack` (`id`, `rack_nombre`, `piso`, `tipo`, `cantidad_actual`, `posicion_especifica`, `articulo_id`) VALUES (46, 'Rack C', 1, 'Alisto', 14, 'Posición 1', 8);
INSERT INTO `posiciones_rack` (`id`, `rack_nombre`, `piso`, `tipo`, `cantidad_actual`, `posicion_especifica`, `articulo_id`) VALUES (47, 'Rack C', 4, 'Altura', 49, 'Posición 1', 8);
INSERT INTO `posiciones_rack` (`id`, `rack_nombre`, `piso`, `tipo`, `cantidad_actual`, `posicion_especifica`, `articulo_id`) VALUES (48, 'Rack C', 2, 'Alisto', 12, 'Posición 1', 9);
INSERT INTO `posiciones_rack` (`id`, `rack_nombre`, `piso`, `tipo`, `cantidad_actual`, `posicion_especifica`, `articulo_id`) VALUES (49, 'Rack C', 5, 'Altura', 44, 'Posición 1', 9);
INSERT INTO `posiciones_rack` (`id`, `rack_nombre`, `piso`, `tipo`, `cantidad_actual`, `posicion_especifica`, `articulo_id`) VALUES (50, 'Rack C', 3, 'Alisto', 16, 'Posición 1', 10);
INSERT INTO `posiciones_rack` (`id`, `rack_nombre`, `piso`, `tipo`, `cantidad_actual`, `posicion_especifica`, `articulo_id`) VALUES (51, 'Rack C', 5, 'Altura', 32, 'Posición 1', 10);

