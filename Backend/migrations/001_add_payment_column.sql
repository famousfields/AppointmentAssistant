CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(256) NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_users_name (name),
  UNIQUE KEY unique_users_email (email)
);

CREATE TABLE IF NOT EXISTS Clients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(48) NOT NULL,
  address VARCHAR(255) NOT NULL,
  notes TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY idx_clients_identity (name, phone, address)
);

CREATE TABLE IF NOT EXISTS Jobs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NOT NULL,
  job_type VARCHAR(120) NOT NULL,
  job_date DATETIME NOT NULL,
  comments TEXT,
  status ENUM('Pending','In Progress','Completed','Cancelled') NOT NULL DEFAULT 'Pending',
  payment DECIMAL(12,2) NOT NULL DEFAULT 0,
  user_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES Clients(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_jobs_user (user_id),
  INDEX idx_jobs_date (job_date)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(512) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY idx_refresh_token (token)
);
