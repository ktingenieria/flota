-- Usuarios y roles
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  rol ENUM('admin','capturista','reportes') NOT NULL DEFAULT 'capturista',
  password_hash VARCHAR(200) NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Vehículos
CREATE TABLE vehicles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  placa VARCHAR(20) UNIQUE,
  no_economico VARCHAR(40) UNIQUE,
  marca VARCHAR(60),
  modelo VARCHAR(60),
  anio SMALLINT,
  vin VARCHAR(40),
  tipo_combustible VARCHAR(40) DEFAULT 'gasolina',
  odometro_actual INT DEFAULT 0,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Alias para resolver vehículo en importación (placa, no_economico, tarjeta)
CREATE TABLE vehicle_aliases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vehicle_id INT NOT NULL,
  alias_type ENUM('placa','no_economico','tarjeta') NOT NULL,
  alias_value VARCHAR(80) NOT NULL,
  UNIQUE KEY uq_alias(alias_type, alias_value),
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Estaciones
CREATE TABLE fuel_stations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  provider_station_id VARCHAR(40),
  nombre VARCHAR(120),
  direccion VARCHAR(255),
  lat DECIMAL(9,6),
  lon DECIMAL(9,6),
  UNIQUE KEY uq_provider_station (provider_station_id, nombre)
) ENGINE=InnoDB;

-- Tickets de combustible
CREATE TABLE fuel_receipts (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  provider_id_consumo VARCHAR(40),
  fecha DATETIME NOT NULL,
  station_id INT,
  vehicle_id INT NOT NULL,
  tarjeta VARCHAR(80),
  producto VARCHAR(120),
  litros DECIMAL(10,3) NOT NULL,
  precio_unit DECIMAL(10,3) NOT NULL,
  iva DECIMAL(10,3) DEFAULT 0,
  total DECIMAL(12,2) NOT NULL,
  kms_reportados INT NOT NULL,
  bomba VARCHAR(40),
  folio VARCHAR(80),
  raw_json JSON,
  UNIQUE KEY uq_provider(provider_id_consumo),
  KEY idx_vehicle_fecha(vehicle_id, fecha),
  FOREIGN KEY (station_id) REFERENCES fuel_stations(id),
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
) ENGINE=InnoDB;

-- Bitácora de odómetro
CREATE TABLE odometer_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  vehicle_id INT NOT NULL,
  fecha DATETIME NOT NULL,
  odometro INT NOT NULL,
  fuente ENUM('manual','carga','mantenimiento','bot') NOT NULL,
  comentario VARCHAR(255),
  KEY idx_vehicle_fecha(vehicle_id, fecha),
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
) ENGINE=InnoDB;

-- Plantillas de mantenimiento (preventivo)
CREATE TABLE maintenance_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  descripcion VARCHAR(255),
  cada_km INT,
  cada_meses INT,
  tolerancia_km INT DEFAULT 500,
  tolerancia_dias INT DEFAULT 15,
  activo TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

-- Eventos de mantenimiento (programados/realizados)
CREATE TABLE maintenance_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  vehicle_id INT NOT NULL,
  template_id INT NOT NULL,
  programado_para_km INT,
  programado_para_fecha DATE,
  realizado_en_km INT,
  realizado_en_fecha DATE,
  costo_total DECIMAL(12,2),
  taller VARCHAR(120),
  notas VARCHAR(255),
  estado ENUM('pendiente','vencido','realizado') NOT NULL DEFAULT 'pendiente',
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
  FOREIGN KEY (template_id) REFERENCES maintenance_templates(id)
) ENGINE=InnoDB;

-- Correctivo
CREATE TABLE repairs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  vehicle_id INT NOT NULL,
  fecha DATE NOT NULL,
  odometro INT,
  descripcion VARCHAR(255) NOT NULL,
  costo_mano_obra DECIMAL(12,2) DEFAULT 0,
  costo_refacciones DECIMAL(12,2) DEFAULT 0,
  proveedor VARCHAR(120),
  notas VARCHAR(255),
  evidencias_url VARCHAR(255),
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
) ENGINE=InnoDB;

-- Documentos (seguro, verificación, etc.)
CREATE TABLE documents (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  vehicle_id INT NOT NULL,
  tipo ENUM('seguro','verificacion','tenencia','tarjeta','itv') NOT NULL,
  vence_en DATE NOT NULL,
  archivo_url VARCHAR(255),
  notas VARCHAR(255),
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
) ENGINE=InnoDB;

-- Recordatorios (materializan próxima por km/fecha)
CREATE TABLE reminders (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  vehicle_id INT NOT NULL,
  origen_template_id INT,
  tipo ENUM('km','fecha') NOT NULL,
  proximo_km INT,
  proxima_fecha DATE,
  estado ENUM('pendiente','enviado','omitido') NOT NULL DEFAULT 'pendiente',
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
  FOREIGN KEY (origen_template_id) REFERENCES maintenance_templates(id)
) ENGINE=InnoDB;

-- Telegram
CREATE TABLE telegram_chats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  chat_id BIGINT NOT NULL UNIQUE,
  rol_cache ENUM('admin','capturista','reportes'),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;
