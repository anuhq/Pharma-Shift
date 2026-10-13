
USE pharmashift_db;

ALTER TABLE leave_request
    ADD COLUMN reviewed_by_employee_id INT NULL,
    ADD COLUMN reviewed_at DATETIME NULL,
    ADD COLUMN review_note VARCHAR(255) NULL,
    ADD CONSTRAINT fk_leave_reviewer
        FOREIGN KEY (reviewed_by_employee_id)
        REFERENCES employee(employee_id);
