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
SELECT source.user_id, source.name, source.normalized_name, '#6d7cff', source.sort_order
FROM (
  SELECT
    grouped.user_id,
    grouped.name,
    grouped.normalized_name,
    ROW_NUMBER() OVER (PARTITION BY grouped.user_id ORDER BY grouped.normalized_name) - 1 AS sort_order
  FROM (
    SELECT
      user_id,
      MIN(TRIM(job_type)) AS name,
      LOWER(TRIM(job_type)) AS normalized_name
    FROM Jobs
    WHERE user_id IS NOT NULL
      AND TRIM(COALESCE(job_type, '')) <> ''
    GROUP BY user_id, LOWER(TRIM(job_type))
  ) AS grouped
) AS source
LEFT JOIN job_types jt
  ON jt.user_id = source.user_id AND jt.normalized_name = source.normalized_name
WHERE jt.id IS NULL;

UPDATE Jobs j
JOIN job_types jt
  ON jt.user_id = j.user_id AND jt.normalized_name = LOWER(TRIM(j.job_type))
SET j.job_type_id = jt.id
WHERE j.job_type_id IS NULL;
