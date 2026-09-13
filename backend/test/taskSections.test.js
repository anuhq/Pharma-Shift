const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateSection } = require('../src/validation/taskSectionValidation');

const examples = {
  templates: { template_name: ' Check stock ', description: ' Instructions ', priority: 'Medium' },
  checklists: { checklist_name: 'Opening routine', shift_type_id: 1, frequency: 'Daily' },
  handovers: { employee_id: 1, to_shift_type_id: 2, handover_date: '2026-09-12', notes: 'Check pending work', priority: 'High' },
};

test('validates each section and assigns its initial status', () => {
  for (const [section, input] of Object.entries(examples)) {
    const { errors, value } = validateSection(section, { ...input, status: 'unexpected' });
    assert.deepEqual(errors, {});
    assert.equal(value.status, section === 'handovers' ? 'Open' : 'Active');
  }
  const { value } = validateSection('templates', examples.templates);
  assert.equal(value.template_name, 'Check stock');
  assert.equal(value.checklist_id, null);
});

test('rejects invalid section form fields and impossible dates', () => {
  const invalid = [
    ['templates', { template_name: ' ' }],
    ['templates', { template_name: 'x'.repeat(101) }],
    ['templates', { description: 'x'.repeat(256) }],
    ['templates', { checklist_id: '1' }],
    ['templates', { priority: 'Urgent' }],
    ['checklists', { shift_type_id: null }],
    ['checklists', { frequency: ' ' }],
    ['checklists', { frequency: 'x'.repeat(51) }],
    ['handovers', { notes: ' ' }],
    ['handovers', { notes: 'x'.repeat(501) }],
    ['handovers', { employee_id: -1 }],
    ['handovers', { to_shift_type_id: 2147483648 }],
    ['handovers', { handover_date: '2026-02-29' }],
    ['handovers', { handover_date: '2026-04-31' }],
  ];
  for (const [section, fields] of invalid) {
    assert.ok(Object.keys(validateSection(section, { ...examples[section], ...fields }).errors).length);
  }
  for (const section of Object.keys(examples)) {
    for (const input of [null, [], 'text']) assert.ok(Object.keys(validateSection(section, input).errors).length);
  }
});

test('MySQL API creates and reads linked checklists, templates and handovers', { skip: process.env.TASK_DB_TEST !== '1' }, async () => {
  require('dotenv').config({ quiet: true });
  const pool = require('../src/config/db');
  // This test exercises task persistence, with sessions isolated from MySQL.
  require.cache[require.resolve('../src/config/session')] = {
    exports: {
      sessionMiddleware: require('express-session')({
        secret: 'task-section-tests-only-session-secret',
        resave: false,
        saveUninitialized: false,
      }),
    },
  };
  const app = require('../src/app');
  const marker = `Temporary section verification ${Date.now()}`;
  let server;
  const created = [];
  try {
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/tasks`;
    const options = await fetch(`${base}/options`).then((response) => response.json());
    assert.ok(options.employees.length && options.shifts.length, 'An active employee and shift are needed for this opt-in test.');
    const employeeId = options.employees[0].employee_id;
    const shiftId = options.shifts[0].shift_type_id;
    async function create(section, body, table, idField) {
      const response = await fetch(`${base}/${section}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json();
      assert.equal(response.status, 201, JSON.stringify(data));
      created.push([table, idField, data.record[idField]]);
      const detail = await fetch(`${base}/${section}/${data.record[idField]}`).then((res) => res.json());
      assert.deepEqual(detail.record, data.record);
      const list = await fetch(`${base}/${section}`).then((res) => res.json());
      assert.ok(list.records.some((record) => record[idField] === data.record[idField]));
      return data.record;
    }
    const checklist = await create('checklists', { checklist_name: marker, shift_type_id: shiftId, frequency: 'Every shift' }, 'task_checklist', 'checklist_id');
    assert.equal(checklist.shift_name, options.shifts[0].shift_name);
    const template = await create('templates', { template_name: marker, description: 'Test instructions', checklist_id: checklist.checklist_id, priority: 'Low' }, 'task_template', 'template_id');
    assert.equal(template.checklist_name, marker);
    const unlinked = await create('templates', { template_name: marker, priority: 'High' }, 'task_template', 'template_id');
    assert.equal(unlinked.checklist_id, null);
    const handover = await create('handovers', { employee_id: employeeId, to_shift_type_id: shiftId, handover_date: '2026-09-12', notes: marker, priority: 'High' }, 'shift_handover', 'handover_id');
    assert.equal(handover.handover_date, '2026-09-12');
    assert.equal(handover.employee_name, options.employees[0].full_name);
    assert.equal(handover.status, 'Open');
    const updated = await fetch(`${base}/options`).then((res) => res.json());
    assert.ok(updated.templates.some((item) => item.template_id === template.template_id));
    assert.ok(updated.checklists.some((item) => item.checklist_id === checklist.checklist_id));
    const assignmentResponse = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      template_id: template.template_id, employee_id: employeeId, assigned_date: '2026-09-12', priority: 'Medium',
    }) });
    assert.equal(assignmentResponse.status, 201);
    const { task: assignment } = await assignmentResponse.json();
    created.push(['task_assignment', 'assignment_id', assignment.assignment_id]);
    for (const status of ['In Progress', 'Completed', 'Completed']) {
      const response = await fetch(`${base}/${assignment.assignment_id}/progress`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, completion_note: 'Verification note', template_id: 2147483647 }),
      });
      assert.equal(response.status, 200);
      const { task } = await response.json();
      assert.equal(task.status, status);
      assert.equal(task.completion_note, 'Verification note');
      assert.equal(task.template_id, template.template_id);
      const reloaded = await fetch(`${base}/${assignment.assignment_id}`).then((res) => res.json());
      assert.equal(reloaded.task.status, status);
      const [stored] = await pool.execute('SELECT status, completion_note FROM task_assignment WHERE assignment_id = ?', [assignment.assignment_id]);
      assert.equal(stored[0].status, status);
      assert.equal(stored[0].completion_note, 'Verification note');
    }
    const missingProgress = await fetch(`${base}/2147483647/progress`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'Completed' }) });
    assert.equal(missingProgress.status, 404);
    for (const section of Object.keys(examples)) {
      const invalid = await fetch(`${base}/${section}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      assert.equal(invalid.status, 400);
      assert.equal((await fetch(`${base}/${section}/invalid`)).status, 400);
      assert.equal((await fetch(`${base}/${section}/2147483647`)).status, 404);
    }
    for (const [section, body] of [
      ['templates', { ...examples.templates, checklist_id: 2147483647 }],
      ['checklists', { ...examples.checklists, shift_type_id: 2147483647 }],
      ['handovers', { ...examples.handovers, employee_id: 2147483647 }],
    ]) {
      const response = await fetch(`${base}/${section}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      assert.equal(response.status, 400);
    }
  } finally {
    // Remove only records created by this test, in reverse dependency order.
    try {
      for (const [table, idField, id] of created.reverse()) await pool.execute(`DELETE FROM ${table} WHERE ${idField} = ?`, [id]);
    } finally {
      if (server) await new Promise((resolve) => server.close(resolve));
      await pool.end();
    }
  }
});
