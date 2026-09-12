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
    order: 'r.handover_date DESC, r.handover_id DESC',
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
  }
}

module.exports = { list, find, create };
