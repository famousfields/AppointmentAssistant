SET @payment_column_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Jobs'
    AND COLUMN_NAME = 'payment'
);

SET @payment_column_sql := IF(
  @payment_column_exists = 0,
  'ALTER TABLE Jobs ADD COLUMN payment DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER status',
  'SELECT 1'
);

PREPARE payment_stmt FROM @payment_column_sql;
EXECUTE payment_stmt;
DEALLOCATE PREPARE payment_stmt;
