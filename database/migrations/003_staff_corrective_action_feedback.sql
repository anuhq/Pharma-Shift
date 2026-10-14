-- Stage 6: Staff corrective-action completion feedback.
-- Run once against pharmashift_db in MySQL Workbench as a schema administrator.
-- Additive migration: does not remove or reset any existing records.
-- Idempotent checks permit safe re-running without duplicate-column errors.
USE pharmashift_db;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'corrective_action'
    AND COLUMN_NAME = 'staff_completion_feedback'
);
SET @statement := IF(@column_exists = 0,
  'ALTER TABLE corrective_action ADD COLUMN staff_completion_feedback VARCHAR(500) NULL',
  'SELECT ''staff_completion_feedback already exists'' AS migration_status');
PREPARE migration_stmt FROM @statement;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'corrective_action'
    AND COLUMN_NAME = 'staff_feedback_submitted_at'
);
SET @statement := IF(@column_exists = 0,
  'ALTER TABLE corrective_action ADD COLUMN staff_feedback_submitted_at DATETIME NULL',
  'SELECT ''staff_feedback_submitted_at already exists'' AS migration_status');
PREPARE migration_stmt FROM @statement;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

-- This read-only check should return both column names.
SELECT COLUMN_NAME, DATA_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'corrective_action'
  AND COLUMN_NAME IN ('staff_completion_feedback', 'staff_feedback_submitted_at')
ORDER BY COLUMN_NAME;
