-- One employee can have only one attendance record per day.
ALTER TABLE attendance
ADD CONSTRAINT uq_attendance_employee_date
UNIQUE (employee_id, attendance_date);