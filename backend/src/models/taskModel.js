const pool = require('../config/db');

const selectTasks = `SELECT a.assignment_id, a.template_id, a.employee_id, a.shift_type_id,
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
    ' ORDER BY a.assigned_date DESC, a.assignment_id DESC';

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
      'SELECT assignment_id FROM task_assignment ' +
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
    const [assignments] = await connection.execute('SELECT assignment_id FROM task_assignment WHERE assignment_id = ? FOR UPDATE', [id]);
    if (!assignments.length) {
      await connection.rollback();
      return null;
    }
    const [users] = await connection.execute("SELECT u.employee_id FROM user u JOIN employee e ON e.employee_id = u.employee_id WHERE u.user_id = ? AND u.status = 'Active' AND e.status = 'Active' FOR UPDATE", [userId]);
    if (!users.length) throw Object.assign(new Error('This user is no longer active. Refresh the task list and choose another user.'), { status: 400 });
    await connection.execute('UPDATE task_assignment SET employee_id = ?, shift_type_id = NULL WHERE assignment_id = ?', [users[0].employee_id, id]);
    const task = await find(id, connection);
    await connection.commit();
    return task;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function handoverOptions() {
  const [shifts] = await pool.execute(
    `SELECT shift_type_id, shift_name
     FROM shift_type
     WHERE status = 'Active'
     ORDER BY shift_name`,
  );

  return { shifts };
}

module.exports = {
  list,
  find,
  options,
  handoverOptions,
  create,
  updateProgress,
  updateAssignee,
};
