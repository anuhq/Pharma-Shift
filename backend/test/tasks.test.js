const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { validateTask } = require('../src/validation/taskValidation');

const valid = { title: ' Check stock ', employee_id: 1, assigned_date: '2026-09-12', priority: 'Medium', due_time: '09:30' };

test('accepts employee and shift tasks, trims text and supports existing templates', () => {
  const result = validateTask(valid);
  assert.deepEqual(result.errors, {});
  assert.equal(result.value.title, 'Check stock');
  assert.deepEqual(validateTask({ ...valid, title: undefined, template_id: 2, employee_id: null, shift_type_id: 3 }).errors, {});
  assert.deepEqual(validateTask({ ...valid, due_time: null }).errors, {});
  assert.deepEqual(validateTask({ ...valid, assigned_date: '2028-02-29' }).errors, {});
});

test('rejects malformed values, impossible dates and ambiguous assignees', () => {
  for (const body of [null, [], 'text', {}, { ...valid, title: ' ' },
    { ...valid, assigned_date: '2026-02-29' }, { ...valid, assigned_date: '2026-04-31' },
    { ...valid, assigned_date: '0000-01-01' }, { ...valid, due_time: '24:00' },
    { ...valid, due_time: false }, { ...valid, employee_id: '1 OR 1=1' },
    { ...valid, shift_type_id: 2 }, { ...valid, employee_id: null },
    { ...valid, priority: 'Urgent' }, { ...valid, title: 'a'.repeat(101) },
    { ...valid, description: 'a'.repeat(256) }]) {
    assert.ok(Object.keys(validateTask(body).errors).length, JSON.stringify(body));
  }
});

// Isolate HTTP behavior from the configured MySQL database.
require.cache[require.resolve('../src/config/db')] = { exports: {} };
const model = require('../src/models/taskModel');
const records = [];
model.list = async () => records;
model.find = async (id) => records.find((task) => task.assignment_id === id);
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
