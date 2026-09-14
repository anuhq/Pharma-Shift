const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { validateTask } = require('../src/validation/taskValidation');
const { validateProgress } = require('../src/validation/taskProgressValidation');

test('progress validation allows supported statuses and bounded notes only', () => {
  for (const status of ['Assigned', 'In Progress', 'Completed']) {
    const { value, errors } = validateProgress({ status, completion_note: ' Work recorded ' });
    assert.deepEqual(errors, {});
    assert.equal(value.completion_note, 'Work recorded');
  }
  assert.equal(validateProgress({ status: 'Completed', completion_note: ' ' }).value.completion_note, null);
  for (const input of [null, [], {}, { status: 'Unknown' }, { status: 'Completed', completion_note: 12 }, { status: 'Completed', completion_note: 'x'.repeat(256) }]) {
    assert.ok(Object.keys(validateProgress(input).errors).length);
  }
});

const valid = { title: ' Check stock ', employee_id: 1, assigned_date: '2026-09-12', priority: 'Medium', due_time: '09:30' };

test('accepts user tasks, trims text and supports existing templates', () => {
  const result = validateTask(valid);
  assert.deepEqual(result.errors, {});
  assert.equal(result.value.title, 'Check stock');
  assert.deepEqual(validateTask({ ...valid, title: undefined, template_id: 2 }).errors, {});
  assert.ok(validateTask({ ...valid, employee_id: null, shift_type_id: 3 }).errors.shift_type_id);
  assert.deepEqual(validateTask({ ...valid, due_time: null }).errors, {});
  assert.deepEqual(validateTask({ ...valid, assigned_date: '2028-02-29' }).errors, {});
});

test('rejects malformed values, impossible dates and ambiguous assignees', () => {
  for (const body of [null, [], 'text', {}, { ...valid, title: ' ' },
    { ...valid, assigned_date: '2026-02-29' }, { ...valid, assigned_date: '2026-04-31' },
    { ...valid, assigned_date: '0000-01-01' }, { ...valid, due_time: '24:00' },
    { ...valid, due_time: false }, { ...valid, employee_id: '1 OR 1=1' },
    { ...valid, shift_type_id: 2 }, { ...valid, employee_id: null },
    { ...valid, priority: 'Urgent' }, { ...valid, title: 'a'.repeat(101) }, { ...valid, assigned_date: '7721-05-10' },
    { ...valid, description: 'a'.repeat(256) }]) {
    assert.ok(Object.keys(validateTask(body).errors).length, JSON.stringify(body));
  }
});

// Isolate HTTP behavior from the configured MySQL database.
require.cache[require.resolve('../src/config/db')] = { exports: {} };
// Give isolated HTTP tests a fake authenticated manager.
// This affects tests only and does not bypass production authentication.
require.cache[require.resolve('../src/config/session')] = {
  exports: {
    sessionMiddleware(req, res, next) {
      req.session = {
        user: { userId: 1 },

        regenerate(callback) {
          callback();
        },

        save(callback) {
          callback();
        },

        destroy(callback) {
          callback();
        },
      };

      next();
    },
  },
};

require.cache[require.resolve('../src/models/authModel')] = {
  exports: {
    async findAccountById() {
      return {
        user_id: 1,
        employee_id: 1,
        username: 'manager.test',
        full_name: 'Test Manager',
        role_name: 'Owner/Manager',
        user_status: 'Active',
        employee_status: 'Active',
      };
    },
  },
};
 model = require('../src/models/taskModel');
const records = [];
model.list = async () => records;
model.find = async (id) => records.find((task) => task.assignment_id === id);
model.updateAssignee = async (id, userId) => {
  const record = records.find((task) => task.assignment_id === id);
  if (!record) return null;
  if (userId !== 1) throw Object.assign(new Error('User unavailable.'), { status: 400 });
  Object.assign(record, { employee_id: 1, shift_type_id: null });
  return record;
};
model.updateProgress = async (id, progress) => {
  const record = records.find((task) => task.assignment_id === id);
  if (!record) return null;
  Object.assign(record, progress);
  return record;
};
model.options = async () => ({ employees: [{ employee_id: 1, full_name: 'Test employee' }], shifts: [], templates: [] });
model.create = async (task) => {
  if (task.employee_id === 99) throw Object.assign(new Error('Selected employee is unavailable.'), { status: 400 });
  const saved = { ...task, assignment_id: records.length + 1, status: 'Assigned' };
  records.push(saved);
  return saved;
};
let server;
let base;
before(async () => {
  const app = require('../src/app');
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api/tasks`;
});
after(async () => { await new Promise((resolve) => server.close(resolve)); });

test('HTTP create, list and detail expose the saved record', async () => {
  const created = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(valid) });
  assert.equal(created.status, 201);
  const { task } = await created.json();
  assert.equal(created.headers.get('location'), `/api/tasks/${task.assignment_id}`);
  assert.equal(task.status, 'Assigned');
  const detail = await fetch(`${base}/${task.assignment_id}`).then((res) => res.json());
  assert.deepEqual(detail.task, task);
  const list = await fetch(base).then((res) => res.json());
  assert.ok(list.tasks.some((item) => item.assignment_id === task.assignment_id));
  const options = await fetch(`${base}/options`).then((res) => res.json());
  assert.equal(options.employees[0].employee_id, 1);
});

test('HTTP rejects invalid input and returns missing-record errors', async () => {
  for (const body of [{}, { ...valid, employee_id: 99 }]) {
    const res = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal(res.status, 400);
  }
  assert.equal((await fetch(`${base}/bad`)).status, 400);
  assert.equal((await fetch(`${base}/9999`)).status, 404);
  const malformed = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).message, 'Request body must be valid JSON.');
});

test('progress endpoint updates only progress fields and handles bad requests', async () => {
  const created = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(valid) }).then((res) => res.json());
  const id = created.task.assignment_id;
  async function patch(target, body) {
    return fetch(`${base}/${target}/progress`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }
  const response = await patch(id, { status: 'In Progress', completion_note: 'Started', employee_id: 999 });
  assert.equal(response.status, 200);
  const { task } = await response.json();
  assert.equal(task.status, 'In Progress');
  assert.equal(task.completion_note, 'Started');
  assert.equal(task.employee_id, valid.employee_id);
  assert.equal((await patch(id, { status: 'Invalid' })).status, 400);
  assert.equal((await patch('bad', { status: 'Completed' })).status, 400);
  assert.equal((await patch(2147483647, { status: 'Completed' })).status, 404);
  const detail = await fetch(`${base}/${id}`).then((res) => res.json());
  assert.equal(detail.task.status, 'In Progress');
});

test('assignee endpoint validates users and preserves other task fields', async () => {
  const created = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(valid) }).then((res) => res.json());
  const id = created.task.assignment_id;
  const patch = (target, userId) => fetch(`${base}/${target}/assignee`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId }),
  });
  for (const invalid of [null, '1', 0, -1, 1.5, 2147483648, 99]) assert.equal((await patch(id, invalid)).status, 400);
  assert.equal((await patch('invalid', 1)).status, 400);
  assert.equal((await patch(2147483647, 1)).status, 404);
  const response = await patch(id, 1);
  assert.equal(response.status, 200);
  const { task } = await response.json();
  assert.equal(task.employee_id, 1);
  assert.equal(task.shift_type_id, null);
  assert.equal(task.status, created.task.status);
  assert.equal(task.priority, created.task.priority);
});
