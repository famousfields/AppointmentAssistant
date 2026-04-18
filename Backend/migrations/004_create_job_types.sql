CREATE TABLE IF NOT EXISTS job_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  normalized_name VARCHAR(120) NOT NULL,
  color VARCHAR(16) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_job_types_user_name (user_id, normalized_name),
  UNIQUE KEY unique_job_types_user_order (user_id, sort_order),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

ALTER TABLE Jobs
  ADD COLUMN job_type_id INT NULL;

ALTER TABLE Jobs
  ADD CONSTRAINT fk_jobs_job_type_id
    FOREIGN KEY (job_type_id) REFERENCES job_types(id) ON DELETE SET NULL;

INSERT INTO job_types (user_id, name, normalized_name, color, sort_order)
SELECT u.id, defaults.name, LOWER(defaults.name), defaults.color, defaults.sort_order
FROM users u
JOIN (
  SELECT 0 AS sort_order, '0 Turn Mower' AS name, '#22c55e' AS color
  UNION ALL SELECT 1, 'Push Mower', '#f97316'
  UNION ALL SELECT 2, 'Riding Mower', '#3b82f6'
  UNION ALL SELECT 3, 'Pressure Washer', '#06b6d4'
) AS defaults
LEFT JOIN job_types jt
  ON jt.user_id = u.id AND jt.normalized_name = LOWER(defaults.name)
WHERE jt.id IS NULL;

UPDATE Jobs j
JOIN job_types jt
  ON jt.user_id = j.user_id AND jt.normalized_name = LOWER(TRIM(j.job_type))
SET j.job_type_id = jt.id
WHERE j.job_type_id IS NULL;
