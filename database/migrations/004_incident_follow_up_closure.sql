-- Stage 7: Incident-level manager follow-up and closure validation.
-- Additive and safe to re-run; the existing closure_date column is retained.
-- Run from MySQL Workbench as a schema administrator; do NOT rerun schema.sql.
USE pharmashift_db;

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'staff_incident'
    AND COLUMN_NAME = 'follow_up_date'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE staff_incident ADD COLUMN follow_up_date DATE NULL',
  'SELECT ''follow_up_date already exists'' AS migration_status');
PREPARE stage7_stmt FROM @sql;
EXECUTE stage7_stmt;
DEALLOCATE PREPARE stage7_stmt;

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'staff_incident'
    AND COLUMN_NAME = 'follow_up_notes'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE staff_incident ADD COLUMN follow_up_notes VARCHAR(500) NULL',
  'SELECT ''follow_up_notes already exists'' AS migration_status');
PREPARE stage7_stmt FROM @sql;
EXECUTE stage7_stmt;
DEALLOCATE PREPARE stage7_stmt;

SELECT COLUMN_NAME, DATA_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'staff_incident'
  AND COLUMN_NAME IN ('follow_up_date', 'follow_up_notes', 'closure_date')
ORDER BY COLUMN_NAME;
