const { test } = require('node:test');
const assert = require('node:assert/strict');

const pool = {};
require.cache[require.resolve('../src/config/db')] = { exports: pool };
const model = require('../src/models/taskSectionModel');
const sectionController = require('../src/controllers/taskSectionController');

function database(record, failure = null) {
  const events = [];
  pool.getConnection = async () => ({
    async beginTransaction() { events.push('begin'); },
    async commit() { events.push('commit'); },
    async rollback() { events.push('rollback'); },
    release() { events.push('release'); },
    async execute(sql, parameters) {
      assert.deepEqual(parameters, [7]);
      if (
  sql.includes('FROM task_assignment') ||
  (
    sql.includes('FROM task_template') &&
    sql.includes('WHERE checklist_id = ?')
  )
) {
  return [[]];
}
      if (sql.startsWith('UPDATE ')) {
        if (failure) throw failure;
        assert.match(sql, /SET status = 'Inactive'/);
        record.status = 'Inactive';
        return [{ affectedRows: 1 }];
      }
      assert.match(sql, /^SELECT /);
      return [record ? [{ ...record }] : []];
    },
  });
  return events;
}

for (const [section, idField] of [['templates', 'template_id'], ['checklists', 'checklist_id']]) {
  test(`${section} deactivation returns an inactive record and preserves its other fields`, async () => {
    const record = { [idField]: 7, status: 'Active', description: 'Keep history' };
    const events = database(record);
    let response;
    await sectionController(section).deactivate(
      { params: { id: '7' } },
      { json(body) { response = body; } },
    );
    assert.deepEqual(response.record, { [idField]: 7, status: 'Inactive', description: 'Keep history' });
    assert.deepEqual(events, ['begin', 'commit', 'release']);
await assert.rejects(
  model.deactivate(section, 7),
  {
    status: 400,
    message: 'This record is already inactive.',
  }
);  });
}

test('missing records return 404 and release the transaction', async () => {
  const events = database(null);
  await assert.rejects(model.deactivate('templates', 7), { status: 404 });
  assert.deepEqual(events, ['begin', 'rollback', 'release']);
});

test('database failures roll back and release the connection', async () => {
  const failure = new Error('Database unavailable');
  const events = database({ template_id: 7, status: 'Active' }, failure);
  await assert.rejects(model.deactivate('templates', 7), failure);
  assert.deepEqual(events, ['begin', 'rollback', 'release']);
});

test('unsupported sections cannot be deactivated', async () => {
  await assert.rejects(model.deactivate('handovers', 7), { status: 400 });
});
