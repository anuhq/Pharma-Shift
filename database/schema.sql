CREATE DATABASE IF NOT EXISTS pharmashift_db;
USE pharmashift_db;

CREATE TABLE `role` (
    role_id INT AUTO_INCREMENT PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL,
    description VARCHAR(255)
);

CREATE TABLE shift_type (
    shift_type_id INT AUTO_INCREMENT PRIMARY KEY,
    shift_name VARCHAR(50) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status VARCHAR(20) NOT NULL
);

CREATE TABLE incident_category (
    category_id INT AUTO_INCREMENT PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL,
    severity_level VARCHAR(20) NOT NULL,
    description VARCHAR(255)
);

CREATE TABLE employee (
    employee_id INT AUTO_INCREMENT PRIMARY KEY,
    role_id INT NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    contact_no VARCHAR(20),
    status VARCHAR(20) NOT NULL,

    CONSTRAINT fk_employee_role
        FOREIGN KEY (role_id)
        REFERENCES `role`(role_id)
);

CREATE TABLE `user` (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL UNIQUE,
    username VARCHAR(50) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL,

    CONSTRAINT fk_user_employee
        FOREIGN KEY (employee_id)
        REFERENCES employee(employee_id)
);

CREATE TABLE shift_roster (
    roster_id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    shift_type_id INT NOT NULL,
    shift_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL,

    CONSTRAINT fk_roster_employee
        FOREIGN KEY (employee_id)
        REFERENCES employee(employee_id),

    CONSTRAINT fk_roster_shift_type
        FOREIGN KEY (shift_type_id)
        REFERENCES shift_type(shift_type_id)
);

CREATE TABLE attendance (
    attendance_id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    attendance_date DATE NOT NULL,
    check_in_time TIME NOT NULL,
    check_out_time TIME,
    status VARCHAR(20) NOT NULL,
    correction_note VARCHAR(255),

    CONSTRAINT fk_attendance_employee
        FOREIGN KEY (employee_id)
        REFERENCES employee(employee_id)
);

CREATE TABLE leave_request (
    leave_request_id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    leave_type VARCHAR(50) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason VARCHAR(255),
    status VARCHAR(20) NOT NULL,

    CONSTRAINT fk_leave_employee
        FOREIGN KEY (employee_id)
        REFERENCES employee(employee_id)
);

CREATE TABLE overtime (
    overtime_id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    overtime_date DATE NOT NULL,
    hours_worked DECIMAL(5,2) NOT NULL,
    status VARCHAR(20) NOT NULL,

    CONSTRAINT fk_overtime_employee
        FOREIGN KEY (employee_id)
        REFERENCES employee(employee_id)
);

CREATE TABLE task_checklist (
    checklist_id INT AUTO_INCREMENT PRIMARY KEY,
    shift_type_id INT NOT NULL,
    checklist_name VARCHAR(100) NOT NULL,
    frequency VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,

    CONSTRAINT fk_checklist_shift_type
        FOREIGN KEY (shift_type_id)
        REFERENCES shift_type(shift_type_id)
);

CREATE TABLE task_template (
    template_id INT AUTO_INCREMENT PRIMARY KEY,
    checklist_id INT,
    template_name VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    priority VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,

    CONSTRAINT fk_template_checklist
        FOREIGN KEY (checklist_id)
        REFERENCES task_checklist(checklist_id)
);

CREATE TABLE task_assignment (
    assignment_id INT AUTO_INCREMENT PRIMARY KEY,
    template_id INT NOT NULL,
    employee_id INT,
    shift_type_id INT,
    assigned_date DATE NOT NULL,
    due_time TIME,
    priority VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    completion_note VARCHAR(255),

    CONSTRAINT fk_assignment_template
        FOREIGN KEY (template_id)
        REFERENCES task_template(template_id),

    CONSTRAINT fk_assignment_employee
        FOREIGN KEY (employee_id)
        REFERENCES employee(employee_id),

    CONSTRAINT fk_assignment_shift_type
        FOREIGN KEY (shift_type_id)
        REFERENCES shift_type(shift_type_id)
);

CREATE TABLE shift_handover (
    handover_id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    to_shift_type_id INT NOT NULL,
    handover_date DATE NOT NULL,
    notes VARCHAR(500) NOT NULL,
    priority VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,

    CONSTRAINT fk_handover_employee
        FOREIGN KEY (employee_id)
        REFERENCES employee(employee_id),

    CONSTRAINT fk_handover_shift_type
        FOREIGN KEY (to_shift_type_id)
        REFERENCES shift_type(shift_type_id)
);

CREATE TABLE staff_incident (
    incident_id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    category_id INT NOT NULL,
    incident_date DATE NOT NULL,
    description VARCHAR(500) NOT NULL,
    status VARCHAR(20) NOT NULL,
    closure_date DATE,

    CONSTRAINT fk_incident_employee
        FOREIGN KEY (employee_id)
        REFERENCES employee(employee_id),

    CONSTRAINT fk_incident_category
        FOREIGN KEY (category_id)
        REFERENCES incident_category(category_id)
);

CREATE TABLE investigation (
    investigation_id INT AUTO_INCREMENT PRIMARY KEY,
    incident_id INT NOT NULL UNIQUE,
    investigation_date DATE NOT NULL,
    findings VARCHAR(500) NOT NULL,
    outcome VARCHAR(255),

    CONSTRAINT fk_investigation_incident
        FOREIGN KEY (incident_id)
        REFERENCES staff_incident(incident_id)
);

CREATE TABLE corrective_action (
    action_id INT AUTO_INCREMENT PRIMARY KEY,
    incident_id INT NOT NULL,
    assigned_employee_id INT NOT NULL,
    action_description VARCHAR(500) NOT NULL,
    due_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL,
    follow_up_details VARCHAR(500),
    completed_date DATE,

    CONSTRAINT fk_corrective_action_incident
        FOREIGN KEY (incident_id)
        REFERENCES staff_incident(incident_id),

    CONSTRAINT fk_corrective_action_employee
        FOREIGN KEY (assigned_employee_id)
        REFERENCES employee(employee_id)
);



