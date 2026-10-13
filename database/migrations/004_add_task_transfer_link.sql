
USE pharmashift_db;

ALTER TABLE task_assignment
    ADD COLUMN transferred_from_assignment_id INT NULL,
    ADD CONSTRAINT uq_task_assignment_transfer_source
        UNIQUE (transferred_from_assignment_id),
    ADD CONSTRAINT fk_task_assignment_transfer_source
        FOREIGN KEY (transferred_from_assignment_id)
        REFERENCES task_assignment(assignment_id);
