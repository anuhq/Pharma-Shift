USE pharmashift_db;

INSERT INTO `role` (role_name, description)
VALUES
('Owner/Manager', 'Management user with authorized access'),
('Pharmacist', 'Authorized pharmacy staff member'),
('Pharmacy Assistant', 'Authorized pharmacy staff member');

INSERT INTO shift_type (shift_name, start_time, end_time, status)
VALUES
('Morning Shift', '08:00:00', '16:00:00', 'Active'),
('Evening Shift', '16:00:00', '22:00:00', 'Active');

INSERT INTO incident_category (category_name, severity_level, description)
VALUES
('Workplace Conduct', 'Medium', 'Staff conduct related incidents'),
('Operational Issue', 'Low', 'Incidents related to daily pharmacy operations');



INSERT INTO employee (role_id, full_name, contact_no, status)
VALUES
(
    (SELECT role_id FROM `role`
     WHERE role_name = 'Owner/Manager' LIMIT 1),
    'Rohana Ariyashantha',
    '0712345678',
    'Active'
),
(
    (SELECT role_id FROM `role`
     WHERE role_name = 'Pharmacist' LIMIT 1),
    'Nimal Perera',
    '0723456789',
    'Active'
),
(
    (SELECT role_id FROM `role`
     WHERE role_name = 'Pharmacy Assistant' LIMIT 1),
    'Kasuni Silva',
    '0774567890',
    'Active'
);


INSERT INTO `user`
(employee_id, username, password_hash, status)
VALUES
(
    (SELECT employee_id FROM employee
     WHERE full_name = 'Rohana Ariyashantha' LIMIT 1),
    'rohana',
    SHA2('DemoPass123!', 256),
    'Active'
),
(
    (SELECT employee_id FROM employee
     WHERE full_name = 'Nimal Perera' LIMIT 1),
    'nimal',
    SHA2('DemoPass456!', 256),
    'Active'
);


INSERT INTO shift_roster
(employee_id, shift_type_id, shift_date, status)
VALUES
(
    (SELECT employee_id FROM employee
     WHERE full_name = 'Rohana Ariyashantha' LIMIT 1),
    (SELECT shift_type_id FROM shift_type
     WHERE shift_name = 'Morning Shift' LIMIT 1),
    '2026-09-05',
    'Assigned'
),
(
    (SELECT employee_id FROM employee
     WHERE full_name = 'Nimal Perera' LIMIT 1),
    (SELECT shift_type_id FROM shift_type
     WHERE shift_name = 'Morning Shift' LIMIT 1),
    '2026-09-05',
    'Assigned'
),
(
    (SELECT employee_id FROM employee
     WHERE full_name = 'Kasuni Silva' LIMIT 1),
    (SELECT shift_type_id FROM shift_type
     WHERE shift_name = 'Evening Shift' LIMIT 1),
    '2026-09-05',
    'Assigned'
);



INSERT INTO attendance
(employee_id, attendance_date, check_in_time, check_out_time, status, correction_note)
VALUES
(
    (SELECT employee_id FROM employee
     WHERE full_name = 'Rohana Ariyashantha' LIMIT 1),
    '2026-09-05',
    '07:55:00',
    '16:05:00',
    'Present',
    NULL
),
(
    (SELECT employee_id FROM employee
     WHERE full_name = 'Nimal Perera' LIMIT 1),
    '2026-09-05',
    '08:05:00',
    '16:00:00',
    'Present',
    NULL
),
(
    (SELECT employee_id FROM employee
     WHERE full_name = 'Kasuni Silva' LIMIT 1),
    '2026-09-05',
    '15:55:00',
    NULL,
    'Checked In',
    NULL
);


INSERT INTO leave_request
(employee_id, leave_type, start_date, end_date, reason, status)
VALUES
(
    (SELECT employee_id FROM employee
     WHERE full_name = 'Nimal Perera' LIMIT 1),
    'Annual Leave',
    '2026-09-10',
    '2026-09-11',
    'Personal requirement',
    'Pending'
),
(
    (SELECT employee_id FROM employee
     WHERE full_name = 'Kasuni Silva' LIMIT 1),
    'Casual Leave',
    '2026-09-15',
    '2026-09-15',
    'Personal appointment',
    'Approved'
);


INSERT INTO overtime
(employee_id, overtime_date, hours_worked, status)
VALUES
(
    (SELECT employee_id FROM employee
     WHERE full_name = 'Nimal Perera' LIMIT 1),
    '2026-09-03',
    2.00,
    'Approved'
),
(
    (SELECT employee_id FROM employee
     WHERE full_name = 'Kasuni Silva' LIMIT 1),
    '2026-09-04',
    1.50,
    'Approved'
);



INSERT INTO task_checklist
(shift_type_id, checklist_name, frequency, status)
VALUES
(
    (SELECT shift_type_id FROM shift_type
     WHERE shift_name = 'Morning Shift' LIMIT 1),
    'Morning Opening Checklist',
    'Daily',
    'Active'
),
(
    (SELECT shift_type_id FROM shift_type
     WHERE shift_name = 'Evening Shift' LIMIT 1),
    'Evening Closing Checklist',
    'Daily',
    'Active'
);


INSERT INTO task_template
(checklist_id, template_name, description, priority, status)
VALUES
(
    (SELECT checklist_id FROM task_checklist
     WHERE checklist_name = 'Morning Opening Checklist' LIMIT 1),
    'Prepare Work Area',
    'Prepare and check the work area for the morning shift',
    'Medium',
    'Active'
),
(
    (SELECT checklist_id FROM task_checklist
     WHERE checklist_name = 'Evening Closing Checklist' LIMIT 1),
    'Complete Closing Check',
    'Complete the required end-of-shift checks',
    'High',
    'Active'
),
(
    NULL,
    'Update Daily Records',
    'Complete required daily operational records',
    'Medium',
    'Active'
);


INSERT INTO task_assignment
(template_id, employee_id, shift_type_id, assigned_date,
 due_time, priority, status, completion_note)
VALUES
(
    (SELECT template_id FROM task_template
     WHERE template_name = 'Prepare Work Area' LIMIT 1),
    (SELECT employee_id FROM employee
     WHERE full_name = 'Nimal Perera' LIMIT 1),
    NULL,
    '2026-09-05',
    '09:00:00',
    'Medium',
    'Assigned',
    NULL
),
(
    (SELECT template_id FROM task_template
     WHERE template_name = 'Complete Closing Check' LIMIT 1),
    NULL,
    (SELECT shift_type_id FROM shift_type
     WHERE shift_name = 'Evening Shift' LIMIT 1),
    '2026-09-05',
    '21:30:00',
    'High',
    'Assigned',
    NULL
),
(
    (SELECT template_id FROM task_template
     WHERE template_name = 'Update Daily Records' LIMIT 1),
    (SELECT employee_id FROM employee
     WHERE full_name = 'Kasuni Silva' LIMIT 1),
    NULL,
    '2026-09-05',
    '20:00:00',
    'Medium',
    'Completed',
    'Daily records updated'
);


INSERT INTO shift_handover
(employee_id, to_shift_type_id, handover_date, notes, priority, status)
VALUES
(
    (SELECT employee_id FROM employee
     WHERE full_name = 'Nimal Perera' LIMIT 1),
    (SELECT shift_type_id FROM shift_type
     WHERE shift_name = 'Evening Shift' LIMIT 1),
    '2026-09-05',
    'Daily records are updated. One assigned task remains for the evening shift.',
    'Medium',
    'Open'
),
(
    (SELECT employee_id FROM employee
     WHERE full_name = 'Kasuni Silva' LIMIT 1),
    (SELECT shift_type_id FROM shift_type
     WHERE shift_name = 'Morning Shift' LIMIT 1),
    '2026-09-06',
    'Closing checklist completed. No urgent pending tasks.',
    'Low',
    'Completed'
);



INSERT INTO staff_incident
(employee_id, category_id, incident_date, description, status, closure_date)
VALUES
(
    (SELECT employee_id FROM employee
     WHERE full_name = 'Nimal Perera' LIMIT 1),
    (SELECT category_id FROM incident_category
     WHERE category_name = 'Workplace Conduct' LIMIT 1),
    '2026-09-02',
    'A workplace conduct issue was reported during the morning shift.',
    'Under Investigation',
    NULL
),
(
    (SELECT employee_id FROM employee
     WHERE full_name = 'Kasuni Silva' LIMIT 1),
    (SELECT category_id FROM incident_category
     WHERE category_name = 'Operational Issue' LIMIT 1),
    '2026-09-03',
    'A daily operational procedure was not completed as required.',
    'Open',
    NULL
);


INSERT INTO investigation
(incident_id, investigation_date, findings, outcome)
VALUES
(
    (SELECT incident_id FROM staff_incident
     WHERE description LIKE 'A workplace conduct issue%' LIMIT 1),
    '2026-09-03',
    'The incident was reviewed and relevant staff information was checked.',
    'Corrective action is required'
);

INSERT INTO corrective_action
(incident_id, assigned_employee_id, action_description,
 due_date, status, follow_up_details, completed_date)
VALUES
(
    (SELECT incident_id FROM staff_incident
     WHERE description LIKE 'A workplace conduct issue%' LIMIT 1),
    (SELECT employee_id FROM employee
     WHERE full_name = 'Rohana Ariyashantha' LIMIT 1),
    'Review the incident with the relevant staff member and record the required action.',
    '2026-09-08',
    'In Progress',
    NULL,
    NULL
),
(
    (SELECT incident_id FROM staff_incident
     WHERE description LIKE 'A daily operational procedure%' LIMIT 1),
    (SELECT employee_id FROM employee
     WHERE full_name = 'Nimal Perera' LIMIT 1),
    'Review the missed procedure and ensure the required operational steps are completed.',
    '2026-09-07',
    'Pending',
    NULL,
    NULL
);
