
const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  validateTaskTransfer,
} = require('../src/validation/taskTransferValidation');

const {
  validateProgress,
} = require('../src/validation/taskProgressValidation');

const validTransfer = {
  user_id: 1,
  shift_type_id: 2,
  assigned_date: '2026-10-24',
};

test('accepts valid transfer details', () => {
  const result = validateTaskTransfer(validTransfer);

  assert.deepEqual(result.errors, {});
  assert.deepEqual(result.value, validTransfer);
});

test('rejects invalid receiving employees', () => {
  for (const user_id of [null, 0, -1, '1', 1.5]) {
    const result = validateTaskTransfer({
      ...validTransfer,
      user_id,
    });

    assert.ok(result.errors.user_id);
  }
});

test('rejects invalid receiving shifts', () => {
  for (const shift_type_id of [null, 0, -1, '2', 1.5]) {
    const result = validateTaskTransfer({
      ...validTransfer,
      shift_type_id,
    });

    assert.ok(result.errors.shift_type_id);
  }
});

test('rejects invalid transfer dates', () => {
  for (const assigned_date of [
    '',
    '2026-02-30',
    '2026-13-01',
    'invalid',
    null,
  ]) {
    const result = validateTaskTransfer({
      ...validTransfer,
      assigned_date,
    });

    assert.ok(result.errors.assigned_date);
  }
});

test('staff cannot set task status to Transferred through progress updates', () => {
  const result = validateProgress({
    status: 'Transferred',
    completion_note: 'Trying to change status',
  });

  assert.ok(result.errors.status);
});

const pool = {};

require.cache[require.resolve('../src/config/db')] = {
  exports: pool,
};

const taskModel = require('../src/models/taskModel');

function fakeTransferDatabase(startStatus) {
  const events = [];

  const original = {
    assignment_id: 26,
    template_id: 5,
    shift_type_id: 1,
    assigned_date: '2026-10-23',
    priority: 'High',
    status: startStatus,
  };

  let newTask = null;

  pool.getConnection = async () => ({
    async beginTransaction() {
      events.push('begin');
    },

    async commit() {
      events.push('commit');
    },

    async rollback() {
      events.push('rollback');
    },

    release() {
      events.push('release');
    },

    async execute(sql, values) {
      if (
        sql.includes('FROM task_assignment') &&
        sql.includes('FOR UPDATE')
      ) {
        return [[{ ...original }]];
      }

      if (sql.includes('FROM user u')) {
        return [[{ employee_id: 9 }]];
      }

      if (
        sql.includes('FROM shift_type') &&
        sql.includes("status = 'Active'")
      ) {
        return [[{
          shift_type_id: 2,
          start_time: '16:00:00',
        }]];
      }

      if (sql.includes('INSERT INTO task_assignment')) {
        assert.deepEqual(
          values,
          [5, 9, 2, '2026-10-24', 'High', 26]
        );

        newTask = {
          assignment_id: 32,
          template_id: 5,
          employee_id: 9,
          shift_type_id: 2,
          assigned_date: '2026-10-24',
          priority: 'High',
          status: 'Assigned',
          transferred_from_assignment_id: 26,
        };

        return [{ insertId: 32 }];
      }

      if (sql.includes('UPDATE task_assignment')) {
        original.status = 'Transferred';
        return [{ affectedRows: 1 }];
      }

      if (sql.includes('FROM task_assignment a JOIN task_template')) {
        const record = values[0] === 26 ? original : newTask;
        return [record ? [{ ...record }] : []];
      }

      throw new Error(`Unexpected test SQL: ${sql}`);
    },
  });

  return {
    events,
    original,
    getNewTask: () => newTask,
  };
}

test('transfers an unfinished task and preserves the original link', async () => {
  const database = fakeTransferDatabase('In Progress');

  const result = await taskModel.transferAssignment(26, validTransfer);

  assert.equal(result.original.status, 'Transferred');
  assert.equal(result.task.status, 'Assigned');
  assert.equal(result.task.assignment_id, 32);
  assert.equal(result.task.transferred_from_assignment_id, 26);
  assert.deepEqual(database.events, ['begin', 'commit', 'release']);
});

test('rejects transferring an already transferred task', async () => {
  const database = fakeTransferDatabase('Transferred');

  await assert.rejects(
    taskModel.transferAssignment(26, validTransfer),
    {
      status: 409,
      message: 'Only unfinished tasks can be transferred.',
    }
  );

  assert.equal(database.getNewTask(), null);
  assert.deepEqual(database.events, ['begin', 'rollback', 'release']);
});
