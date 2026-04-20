CREATE TABLE IF NOT EXISTS account_subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  plan_code VARCHAR(32) NOT NULL DEFAULT 'free',
  subscription_status VARCHAR(32) NOT NULL DEFAULT 'active',
  trial_ends_at DATE NULL,
  current_period_starts_at DATE NOT NULL,
  current_period_ends_at DATE NOT NULL,
  monthly_client_creations INT NOT NULL DEFAULT 0,
  monthly_job_creations INT NOT NULL DEFAULT 0,
  stripe_customer_id VARCHAR(255) NULL,
  stripe_subscription_id VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_account_subscriptions_user_id (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO account_subscriptions (
  user_id,
  plan_code,
  subscription_status,
  current_period_starts_at,
  current_period_ends_at,
  monthly_client_creations,
  monthly_job_creations
)
SELECT
  u.id,
  'free',
  'active',
  CURRENT_DATE(),
  DATE_ADD(CURRENT_DATE(), INTERVAL 1 MONTH),
  0,
  0
FROM users u
LEFT JOIN account_subscriptions s ON s.user_id = u.id
WHERE s.id IS NULL;

ALTER TABLE Clients
  DROP INDEX unique_client_name;

ALTER TABLE Clients
  DROP INDEX unique_client;

ALTER TABLE Clients
  ADD UNIQUE KEY unique_client_per_user (user_id, name, phone, address);

UPDATE Clients c
JOIN (
  SELECT j.client_id, MIN(j.user_id) AS user_id, COUNT(DISTINCT j.user_id) AS user_count
  FROM Jobs j
  WHERE j.user_id IS NOT NULL
  GROUP BY j.client_id
) ownership ON ownership.client_id = c.id
SET c.user_id = ownership.user_id
WHERE c.user_id IS NULL
  AND ownership.user_count = 1;
