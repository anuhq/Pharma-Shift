const pool = require('../config/db');


const selectTasks = `SELECT a.assignment_id, a.template_id, a.employee_id, a.shift_type_id,
  a.transferred_from_assignment_id,

  DATE_FORMAT(a.assigned_date, '%Y-%m-%d') AS assigned_date,
  TIME_FORMAT(a.due_time, '%H:%i') AS due_time, a.priority, a.status,
  a.completion_note, t.template_name AS title, t.description,
  e.full_name AS employee_name, s.shift_name
  FROM task_assignment a JOIN task_template t ON t.template_id = a.template_id
  LEFT JOIN employee e ON e.employee_id = a.employee_id
  LEFT JOIN shift_type s ON s.shift_type_id = a.shift_type_id`;

async function list(currentUser) {
  let query = `${selectTasks}`;
  const parameters = [];

  if (currentUser.role_name !== 'Owner/Manager') {
    query += ' WHERE a.employee_id = ?';
    parameters.push(currentUser.employee_id);
  }

  query +=
    ' ORDER BY a.assignment_id DESC';

  const [rows] = await pool.execute(query, parameters);
  return rows;
}

async function find(id, currentUser, connection = pool) {
  let query = `${selectTasks} WHERE a.assignment_id = ?`;
  const parameters = [id];

  if (currentUser.role_name !== 'Owner/Manager') {
    query += ' AND a.employee_id = ?';
    parameters.push(currentUser.employee_id);
  }

  const [rows] = await connection.execute(query, parameters);
  return rows[0];
}

async function options() {
  const results = await Promise.all([
    pool.execute("SELECT employee_id, full_name FROM employee WHERE status = 'Active' ORDER BY full_name"),
    pool.execute("SELECT shift_type_id, shift_name FROM shift_type WHERE status = 'Active' ORDER BY shift_name"),
    pool.execute("SELECT template_id, template_name, description, priority FROM task_template WHERE status = 'Active' ORDER BY template_name"),
    pool.execute("SELECT checklist_id, checklist_name FROM task_checklist WHERE status = 'Active' ORDER BY checklist_name"),
    pool.execute("SELECT u.user_id, u.employee_id, u.username, e.full_name FROM user u JOIN employee e ON e.employee_id = u.employee_id WHERE u.status = 'Active' AND e.status = 'Active' ORDER BY e.full_name, u.username"),
  ]);
  return { employees: results[0][0], shifts: results[1][0], templates: results[2][0], checklists: results[3][0], users: results[4][0] };
}

async function create(task) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    // Lock selected references until the assignment has been saved.
    const [accounts] = await connection.execute("SELECT u.user_id FROM user u JOIN employee e ON e.employee_id = u.employee_id WHERE u.employee_id = ? AND u.status = 'Active' AND e.status = 'Active' FOR UPDATE", [task.employee_id]);
    if (!accounts.length) throw Object.assign(new Error('Select an active registered user.'), { status: 400 });
    const references = [
      ['employee', 'employee_id', task.employee_id],
      ['shift_type', 'shift_type_id', task.shift_type_id],
      ['task_template', 'template_id', task.template_id],
    ];
    for (const [table, column, id] of references) {
      if (id === null) continue;
      const [rows] = await connection.execute(`SELECT ${column} FROM ${table} WHERE ${column} = ? AND status = 'Active' FOR UPDATE`, [id]);
      if (!rows.length) {
        const error = new Error('The selected template, employee or shift is no longer available. Refresh and try again.');
        error.status = 400;
        throw error;
      }
    }
    let templateId = task.template_id;
    if (templateId === null) {
      const [template] = await connection.execute(
        "INSERT INTO task_template (template_name, description, priority, status) VALUES (?, ?, ?, 'Active')",
        [task.title, task.description || null, task.priority],
      );
      templateId = template.insertId;
    }
    const [result] = await connection.execute(
      `INSERT INTO task_assignment (template_id, employee_id, shift_type_id, assigned_date, due_time, priority, status)
       VALUES (?, ?, ?, ?, ?, ?, 'Assigned')`,
      [templateId, task.employee_id, task.shift_type_id, task.assigned_date, task.due_time, task.priority],
    );
    const saved = await find(
      result.insertId,
      { role_name: 'Owner/Manager' },
      connection,
    );
    await connection.commit();
    return saved;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateProgress(id, progress, currentUser) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    let query =
  'SELECT assignment_id, status FROM task_assignment ' +
  'WHERE assignment_id = ?';
    const parameters = [id];

    if (currentUser.role_name !== 'Owner/Manager') {
      query += ' AND employee_id = ?';
      parameters.push(currentUser.employee_id);
    }

    query += ' FOR UPDATE';

    const [rows] = await connection.execute(
      query,
      parameters,
    );

    if (!rows.length) {
      await connection.rollback();
      return null;
    }

if (['Cancelled', 'Transferred'].includes(rows[0].status)) {
  const error = new Error(
    'Cancelled or transferred tasks cannot be updated.'
  );
  error.status = 409;
  throw error;
}


    await connection.execute(
      `UPDATE task_assignment
       SET status = ?, completion_note = ?
       WHERE assignment_id = ?`,
      [progress.status, progress.completion_note, id],
    );

    const task = await find(id, currentUser, connection);

    await connection.commit();
    return task;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateAssignee(id, userId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [assignments] = await connection.execute(
  'SELECT assignment_id, status FROM task_assignment WHERE assignment_id = ? FOR UPDATE',
  [id]
);
    if (!assignments.length) {
      await connection.rollback();
      return null;
    }
    if (['Cancelled', 'Completed', 'Transferred'].includes(assignments[0].status)) {
  const error = new Error(
    'Completed, cancelled or transferred tasks cannot be reassigned.'
  );
  error.status = 409;
  throw error;
}
    const [users] = await connection.execute("SELECT u.employee_id FROM user u JOIN employee e ON e.employee_id = u.employee_id WHERE u.user_id = ? AND u.status = 'Active' AND e.status = 'Active' FOR UPDATE", [userId]);
    if (!users.length) throw Object.assign(new Error('This user is no longer active. Refresh the task list and choose another user.'), { status: 400 });
    await connection.execute('UPDATE task_assignment SET employee_id = ?, shift_type_id = NULL WHERE assignment_id = ?', [users[0].employee_id, id]);
    const task = await find(id, { role_name: 'Owner/Manager' }, connection);
    await connection.commit();
    return task;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
async function updateAssignment(id, updates) {
  const allowedFields = ['assigned_date', 'due_time', 'priority'];
  const entries = Object.entries(updates);

  if (
    entries.length === 0 ||
    entries.some(([field]) => !allowedFields.includes(field))
  ) {
    throw Object.assign(
      new Error('Invalid task update fields.'),
      { status: 400 }
    );
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT assignment_id, status
       FROM task_assignment
       WHERE assignment_id = ?
       FOR UPDATE`,
      [id]
    );

    if (!rows.length) {
      await connection.rollback();
      return null;
    }

   if (['Completed', 'Cancelled', 'Transferred'].includes(rows[0].status)) {
  throw Object.assign(
    new Error('Completed, cancelled or transferred tasks cannot be edited.'),
    { status: 409 }
  );
}

    const setClause = entries
      .map(([field]) => `${field} = ?`)
      .join(', ');

    const values = entries.map(([, value]) => value);

    await connection.execute(
      `UPDATE task_assignment
       SET ${setClause}
       WHERE assignment_id = ?`,
      [...values, id]
    );

    const task = await find(
      id,
      { role_name: 'Owner/Manager' },
      connection
    );

    await connection.commit();
    return task;

  } catch (error) {
    await connection.rollback();
    throw error;

  } finally {
    connection.release();
  }
}


async function cancelAssignment(id) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT assignment_id, status
       FROM task_assignment
       WHERE assignment_id = ?
       FOR UPDATE`,
      [id]
    );

    if (!rows.length) {
      await connection.rollback();
      return null;
    }

    if (rows[0].status === 'Completed') {
      throw Object.assign(
        new Error('Completed tasks cannot be cancelled.'),
        { status: 409 }
      );
    }

    if (rows[0].status === 'Cancelled') {
      throw Object.assign(
        new Error('This task is already cancelled.'),
        { status: 409 }
      );
    }

if (rows[0].status === 'Transferred') {
  throw Object.assign(
    new Error('Transferred tasks cannot be cancelled.'),
    { status: 409 }
  );
}


    await connection.execute(
      `UPDATE task_assignment
       SET status = 'Cancelled'
       WHERE assignment_id = ?`,
      [id]
    );

    const task = await find(
      id,
      { role_name: 'Owner/Manager' },
      connection
    );

    await connection.commit();
    return task;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function handoverOptions(){
  const [shifts] = await pool.execute(
    `SELECT shift_type_id, shift_name
     FROM shift_type
     WHERE status = 'Active'
     ORDER BY shift_name`,
  );

  return { shifts };
}

async function transferAssignment(id, transfer) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT assignment_id, template_id, shift_type_id,
              DATE_FORMAT(assigned_date, '%Y-%m-%d') AS assigned_date,
              priority, status
       FROM task_assignment
       WHERE assignment_id = ?
       FOR UPDATE`,
      [id]
    );

    if (!rows.length) {
      await connection.rollback();
      return null;
    }

    const original = rows[0];

    if (!['Assigned', 'In Progress'].includes(original.status)) {
      throw Object.assign(
        new Error('Only unfinished tasks can be transferred.'),
        { status: 409 }
      );
    }

    const [users] = await connection.execute(
      `SELECT u.employee_id
       FROM user u
       JOIN employee e ON e.employee_id = u.employee_id
       WHERE u.user_id = ?
         AND u.status = 'Active'
         AND e.status = 'Active'
       FOR UPDATE`,
      [transfer.user_id]
    );

    if (!users.length) {
      throw Object.assign(
        new Error('Select an active registered employee.'),
        { status: 400 }
      );
    }

    const [shifts] = await connection.execute(
      `SELECT shift_type_id, start_time
       FROM shift_type
       WHERE shift_type_id = ? AND status = 'Active'
       FOR UPDATE`,
      [transfer.shift_type_id]
    );

    if (!shifts.length) {
      throw Object.assign(
        new Error('Select an active receiving shift.'),
        { status: 400 }
      );
    }

    if (transfer.assigned_date < original.assigned_date) {
      throw Object.assign(
        new Error('The receiving shift date cannot be earlier than the original task date.'),
        { status: 400 }
      );
    }

    if (transfer.assigned_date === original.assigned_date) {
      if (original.shift_type_id === null) {
        throw Object.assign(
          new Error('The original task has no shift. Choose a later date.'),
          { status: 400 }
        );
      }

      const [originalShifts] = await connection.execute(
        `SELECT start_time
         FROM shift_type
         WHERE shift_type_id = ?`,
        [original.shift_type_id]
      );

      if (
        !originalShifts.length ||
        shifts[0].start_time <= originalShifts[0].start_time
      ) {
        throw Object.assign(
          new Error('Select a later shift for the same day.'),
          { status: 400 }
        );
      }
    }

    const [result] = await connection.execute(
      `INSERT INTO task_assignment
        (template_id, employee_id, shift_type_id,
         assigned_date, due_time, priority, status,
         transferred_from_assignment_id)
       VALUES (?, ?, ?, ?, NULL, ?, 'Assigned', ?)`,
      [
        original.template_id,
        users[0].employee_id,
        transfer.shift_type_id,
        transfer.assigned_date,
        original.priority,
        id,
      ]
    );

    await connection.execute(
      `UPDATE task_assignment
       SET status = 'Transferred'
       WHERE assignment_id = ?`,
      [id]
    );

    const newTask = await find(
      result.insertId,
      { role_name: 'Owner/Manager' },
      connection
    );

    const originalTask = await find(
      id,
      { role_name: 'Owner/Manager' },
      connection
    );

    await connection.commit();

    return {
      task: newTask,
      original: originalTask,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}


module.exports = {
  list,
  find,
  options,
  handoverOptions,
  create,
  updateProgress,
  updateAssignee,
  updateAssignment,
  cancelAssignment,
  transferAssignment,
};
