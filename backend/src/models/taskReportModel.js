
const pool = require('../config/db');

async function getSummary() {
  const [taskResults, handoverResults] = await Promise.all([
    pool.execute(
      `SELECT status, COUNT(*) AS total
       FROM task_assignment
       GROUP BY status
       ORDER BY status`
    ),
    pool.execute(
      `SELECT status, COUNT(*) AS total
       FROM shift_handover
       GROUP BY status
       ORDER BY status`
    ),
  ]);

  return {
    tasks: taskResults[0],
    handovers: handoverResults[0],
  };
}

module.exports = { getSummary };
