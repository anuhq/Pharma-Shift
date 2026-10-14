const pool = require('../config/db');

// Identifiers come only from these fixed definitions, never from request data.
const definitions = {
  templates: {
    table: 'task_template', id: 'template_id',
    fields: ['template_name', 'description', 'checklist_id', 'priority', 'status'],
    references: [['checklist_id', 'task_checklist']],
    select: `SELECT r.*, c.checklist_name FROM task_template r
      LEFT JOIN task_checklist c ON c.checklist_id = r.checklist_id`,
    order: 'r.template_id DESC',
  },
  checklists: {
    table: 'task_checklist', id: 'checklist_id',
    fields: ['checklist_name', 'shift_type_id', 'frequency', 'status'],
    references: [['shift_type_id', 'shift_type']],
    select: `SELECT r.*, s.shift_name FROM task_checklist r
      JOIN shift_type s ON s.shift_type_id = r.shift_type_id`,
    order: 'r.checklist_id DESC',
  },
  handovers: {
    table: 'shift_handover', id: 'handover_id',
    fields: ['employee_id', 'to_shift_type_id', 'handover_date', 'notes', 'priority', 'status'],
    references: [['employee_id', 'employee'], ['to_shift_type_id', 'shift_type', 'shift_type_id']],
    select: `SELECT r.handover_id, r.employee_id, r.to_shift_type_id,
      DATE_FORMAT(r.handover_date, '%Y-%m-%d') AS handover_date, r.notes, r.priority, r.status,
      e.full_name AS employee_name, s.shift_name FROM shift_handover r
      JOIN employee e ON e.employee_id = r.employee_id
      JOIN shift_type s ON s.shift_type_id = r.to_shift_type_id`,
    order: 'r.handover_id DESC',
  },
};

async function list(section) {
  const definition = definitions[section];
  const [rows] = await pool.execute(`${definition.select} ORDER BY ${definition.order}`);
  return rows;
}

async function find(section, id, connection = pool) {
  const definition = definitions[section];
  const [rows] = await connection.execute(`${definition.select} WHERE r.${definition.id} = ?`, [id]);
  return rows[0];
}

async function create(section, value) {
  const definition = definitions[section];
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const [field, table, column = field] of definition.references) {
      if (value[field] === null) continue;
      const [rows] = await connection.execute(`SELECT ${column} FROM ${table} WHERE ${column} = ? AND status = 'Active' FOR UPDATE`, [value[field]]);
      if (!rows.length) throw Object.assign(new Error('The selected employee, shift or checklist is no longer active. Close the form and try again.'), { status: 400 });
    }
    const [result] = await connection.execute(
      `INSERT INTO ${definition.table} (${definition.fields.join(', ')}) VALUES (${definition.fields.map(() => '?').join(', ')})`,
      definition.fields.map((field) => value[field]),
    );
    const record = await find(section, result.insertId, connection);
    await connection.commit();
    return record;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
   }}

async function updateHandover(id, value, currentUser) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT handover_id, employee_id, status
       FROM shift_handover
       WHERE handover_id = ?
       FOR UPDATE`,
      [id]
    );

    if (!rows.length) {
      await connection.rollback();
      return null;
    }

    const handover = rows[0];
    const isManager = currentUser.role_name === 'Owner/Manager';
    const isOwner = handover.employee_id === currentUser.employee_id;

    if (!isManager && !isOwner) {
      await connection.rollback();
      return null;
    }

    if (handover.status !== 'Open') {
      throw Object.assign(
        new Error('Only open handovers can be edited.'),
        { status: 409 }
      );
    }

    const [shifts] = await connection.execute(
      `SELECT shift_type_id
       FROM shift_type
       WHERE shift_type_id = ? AND status = 'Active'
       FOR UPDATE`,
      [value.to_shift_type_id]
    );

    if (!shifts.length) {
      throw Object.assign(
        new Error('Select an active shift.'),
        { status: 400 }
      );
    }

    await connection.execute(
      `UPDATE shift_handover
       SET to_shift_type_id = ?,
           handover_date = ?,
           notes = ?,
           priority = ?
       WHERE handover_id = ?`,
      [
        value.to_shift_type_id,
        value.handover_date,
        value.notes,
        value.priority,
        id,
      ]
    );

    const updated = await find('handovers', id, connection);

    await connection.commit();
    return updated;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}


async function completeHandover(id, currentUser) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT handover_id, employee_id, status
       FROM shift_handover
       WHERE handover_id = ?
       FOR UPDATE`,
      [id]
    );

    if (!rows.length) {
      await connection.rollback();
      return null;
    }

    const handover = rows[0];
    const isManager = currentUser.role_name === 'Owner/Manager';
    const isOwner =
      Number(handover.employee_id) === Number(currentUser.employee_id);

    if (!isManager && !isOwner) {
      await connection.rollback();
      return null;
    }

    if (handover.status !== 'Open') {
      throw Object.assign(
        new Error('Only open handovers can be completed.'),
        { status: 409 }
      );
    }

    await connection.execute(
      `UPDATE shift_handover
       SET status = 'Completed'
       WHERE handover_id = ?`,
      [id]
    );

    const record = await find('handovers', id, connection);

    await connection.commit();
    return record;
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
  create,
  update,
  deactivate,
  updateHandover,
  completeHandover,
};
async function deactivate(section, id) {
  if (!['templates', 'checklists'].includes(section)) {
    throw Object.assign(new Error('This record cannot be deactivated.'), { status: 400 });
  }

  const definition = definitions[section];
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [existing] = await connection.execute(
  `SELECT status FROM ${definition.table}
   WHERE ${definition.id} = ? FOR UPDATE`,
  [id],
);
    if (!existing.length) {
      throw Object.assign(new Error('Record not found.'), { status: 404 });
    }
        // Do not deactivate an already inactive record.
    if (existing[0].status !== 'Active') {
      throw Object.assign(
        new Error('This record is already inactive.'),
        { status: 400 }
      );
    }

    // Protect checklists used by active templates.
    if (section === 'checklists') {
      const [linked] = await connection.execute(
        `SELECT template_id FROM task_template
         WHERE checklist_id = ? AND status = 'Active'
         LIMIT 1 FOR UPDATE`,
        [id]
      );

      if (linked.length > 0) {
        throw Object.assign(
          new Error(
            'Cannot deactivate this checklist because an active task template uses it.'
          ),
          { status: 400 }
        );
      }
    }

    // Protect templates with unfinished assignments.
    if (section === 'templates') {
      const [unfinished] = await connection.execute(
        `SELECT assignment_id FROM task_assignment
         WHERE template_id = ? AND status IN ('Assigned', 'In Progress')
         LIMIT 1 FOR UPDATE`,
        [id]
      );

      if (unfinished.length > 0) {
        throw Object.assign(
          new Error(
            'Cannot deactivate this template because it has unfinished task assignments.'
          ),
          { status: 400 }
        );
      }
    }
    await connection.execute(
      `UPDATE ${definition.table} SET status = 'Inactive' WHERE ${definition.id} = ?`,
      [id],
    );
    const record = await find(section, id, connection);
    await connection.commit();
    return record;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

 async function update(section, id, value) {
  if (!['templates', 'checklists'].includes(section)) {
    throw Object.assign(
      new Error('This record cannot be edited.'),
      { status: 400 }
    );
  }

  const definition = definitions[section];
  const fields = definition.fields.filter(
    (field) => field !== 'status'
  );

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [existing] = await connection.execute(
      `SELECT ${definition.id} FROM ${definition.table}
       WHERE ${definition.id} = ? FOR UPDATE`,
      [id]
    );

    if (!existing.length) {
      throw Object.assign(
        new Error('Record not found.'),
        { status: 404 }
      );
    }

    for (const [field, table, column = field] of definition.references) {
      if (value[field] === null) continue;

      const [rows] = await connection.execute(
        `SELECT ${column} FROM ${table}
         WHERE ${column} = ? AND status = 'Active' FOR UPDATE`,
        [value[field]]
      );

      if (!rows.length) {
        throw Object.assign(
          new Error('Selected shift or checklist is no longer active.'),
          { status: 400 }
        );
      }
    }

    await connection.execute(
      `UPDATE ${definition.table}
       SET ${fields.map((field) => `${field} = ?`).join(', ')}
       WHERE ${definition.id} = ?`,
      [...fields.map((field) => value[field]), id]
    );

    const record = await find(section, id, connection);

    await connection.commit();
    return record;

  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
