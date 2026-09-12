const pool = require('../config/db');

const ACCOUNT_SELECT = `
  SELECT
    u.user_id,
    u.employee_id,
    u.username,
    u.password_hash,
    u.status AS user_status,
    e.full_name,
    e.status AS employee_status,
    r.role_name
  FROM \`user\` AS u
  JOIN employee AS e ON e.employee_id = u.employee_id
  JOIN \`role\` AS r ON r.role_id = e.role_id
`;

async function findAccountByUsername(username) {
  const [rows] = await pool.execute(
    `${ACCOUNT_SELECT}
     WHERE u.username = ?
     LIMIT 1`,
    [username]
  );

  return rows[0] || null;
}

async function findAccountById(userId) {
  if (!Number.isInteger(userId) || userId < 1) {
    return null;
  }

  const [rows] = await pool.execute(
    `${ACCOUNT_SELECT}
     WHERE u.user_id = ?
     LIMIT 1`,
    [userId]
  );

  return rows[0] || null;
}

module.exports = {
  findAccountByUsername,
  findAccountById,
};