import { useEffect, useState } from 'react';
import AddTaskModal from '../components/tasks/AddTaskModal';
import { getTasks } from '../services/taskApi';

const sections = [
  {
    id: 'assignments',
    title: 'Task Assignments',
    description:
      'Assign daily work to employees or shifts and track its progress.',
    columns: ['Task', 'Assigned To', 'Date', 'Due Time', 'Priority', 'Status'],
  },
  {
    id: 'templates',
    title: 'Task Templates',
    description:
      'Manage reusable tasks that can be assigned whenever needed.',
    columns: ['Template', 'Checklist', 'Priority', 'Status'],
  },
  {
    id: 'checklists',
    title: 'Checklists',
    description:
      'Organise recurring tasks for opening, closing and other shift routines.',
    columns: ['Checklist', 'Shift', 'Frequency', 'Status'],
  },
  {
    id: 'handovers',
    title: 'Shift Handovers',
    description:
      'Record pending work and information needed by the next shift.',
    columns: ['Recorded By', 'Next Shift', 'Date', 'Priority', 'Status'],
  },
];

function TaskHandover() {
  const [activeSectionId, setActiveSectionId] = useState('assignments');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskRecords, setTaskRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [success, setSuccess] = useState('');
  const [reload, setReload] = useState(0);

  const activeSection = sections.find((section) => section.id === activeSectionId);

  useEffect(() => {
    const controller = new AbortController();
    getTasks(controller.signal)
      .then(({ tasks }) => { setTaskRecords(tasks); setLoadError(''); })
      .catch((error) => { if (error.name !== 'AbortError') setLoadError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload]);

  function refreshTasks() {
    setLoading(true);
    setLoadError('');
    setReload((value) => value + 1);
  }

  function handleSaved(task) {
    setTaskRecords((records) => [task, ...records].sort((a, b) =>
      b.assigned_date.localeCompare(a.assigned_date) || b.assignment_id - a.assignment_id));
    setSuccess('Task "' + task.title + '" saved successfully.');
    setShowTaskModal(false);
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="mb-1">Daily Task &amp; Shift Handover</h2>
        <p className="text-muted mb-0">
          Organise daily tasks, track progress and prepare shift handovers.
        </p>
      </div>

      <div
        className="d-flex flex-wrap gap-2 mb-4"
        role="group"
        aria-label="Task and handover sections"
      >
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            className={
              activeSectionId === section.id
                ? 'btn btn-primary'
                : 'btn btn-outline-primary'
            }
            aria-pressed={activeSectionId === section.id}
            aria-controls="task-handover-content"
            onClick={() => setActiveSectionId(section.id)}
          >
            {section.title}
          </button>
        ))}
      </div>

      <section
        id="task-handover-content"
        className="card border-0 shadow-sm"
        aria-labelledby="task-handover-section-title"
      >
        <div className="card-body p-4">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
            <div>
              <h3 id="task-handover-section-title" className="h5 mb-2">
                {activeSection.title}
              </h3>

              <p className="text-muted mb-0">
                {activeSection.description}
              </p>
            </div>

            {activeSectionId === 'assignments' && (
              <button
                type="button"
                className="btn btn-success flex-shrink-0"
                onClick={() => { setSuccess(''); setShowTaskModal(true); }}
                disabled={loading}
              >
                Add Task
              </button>
            )}
          </div>

          {activeSectionId === 'assignments' && <>
            {success && <div className="alert alert-success" role="status">{success}</div>}
            {loadError && <div className="alert alert-danger" role="alert">{loadError}</div>}
            <button type="button" className="btn btn-outline-secondary btn-sm mb-3" disabled={loading} onClick={refreshTasks}>
              {loading ? 'Loading...' : 'Refresh tasks'}
            </button>
          </>}
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <caption className="visually-hidden">
                {activeSection.title}
              </caption>

              <thead className="table-light">
                <tr>
                  {activeSection.columns.map((column) => (
                    <th key={column} scope="col">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {activeSectionId === 'assignments' && taskRecords.length > 0 ? (
                  taskRecords.map((record) => (
                    <tr key={record.assignment_id}>
                      <td><div>{record.title}</div>{record.description && <div className="small text-muted">{record.description}</div>}</td>
                      <td>{record.employee_name || record.shift_name || 'Unassigned'}</td>
                      <td>{record.assigned_date || '—'}</td>
                      <td>{record.due_time || '—'}</td>
                      <td>{record.priority}</td>
                      <td>{record.status}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={activeSection.columns.length}
                      className="text-center text-muted py-5"
                    >
                      {activeSectionId === 'assignments' ? (loading ? 'Loading tasks...' : loadError ? 'Tasks could not be loaded. Use Refresh tasks to retry.' : 'No tasks yet. Click Add Task to create one.') : 'Records have not been loaded.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {showTaskModal && <AddTaskModal onClose={() => setShowTaskModal(false)} onSaved={handleSaved} />}

    </div>
  );
}

export default TaskHandover;