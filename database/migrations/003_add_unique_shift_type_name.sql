-- Prevent duplicate shift type names.
-- Apply this migration only to databases that do not
-- already have the uq_shift_type_name constraint.

ALTER TABLE shift_type
ADD CONSTRAINT uq_shift_type_name
UNIQUE (shift_name);