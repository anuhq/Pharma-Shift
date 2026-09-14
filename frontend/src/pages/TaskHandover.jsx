import { useEffect, useRef, useState } from 'react';
import AddTaskModal from '../components/tasks/AddTaskModal';
import TaskSectionRecords from '../components/tasks/TaskSectionRecords';
import TaskProgressModal from '../components/tasks/TaskProgressModal';
import TaskBadge from '../components/tasks/TaskBadge';
import { getTasks, getTaskOptions, updateTaskAssignee } from '../services/taskApi';
import { useAuth } from '../auth/useAuth';
const sections = [
  {
    id: 'assignments',
    title: 'Task Assignments',
    description:
      'Assign daily work to registered users and track its progress.',
    columns: ['Task', 'Assigned To', 'Date', 'Due Time', 'Priority', 'Status', 'Progress Note', 'Actions'],
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
  const [progressTask, setProgressTask] = useState(null);
  const [users, setUsers] = useState([]);
  const [savingAssignee, setSavingAssignee] = useState(null);
  const [assignmentError, setAssignmentError] = useState('');
  const savingAssigneeRef = useRef(false);
  const { user } = useAuth();
  const isManager = user?.roleName === 'Owner/Manager';
  const activeSection = sections.find((section) => section.id === activeSectionId);

  useEffect(() => {
  const controller = new AbortController();

  async function loadTasks() {
    try {
      if (isManager) {
        const [{ tasks }, options] = await Promise.all([
          getTasks(controller.signal),
          getTaskOptions(controller.signal),
        ]);

        if (!controller.signal.aborted) {
          setTaskRecords(tasks);
          setUsers(options.users);
        }
      } else {
        const { tasks } = await getTasks(controller.signal);

        if (!controller.signal.aborted) {
          setTaskRecords(tasks);
          setUsers([]);
        }
      }

      if (!controller.signal.aborted) {
        setLoadError('');
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        setLoadError(error.message);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }

  loadTasks();

  return () => controller.abort();
}, [isManager, reload]);

  function refreshTasks() {
    setLoading(true);
    setLoadError('');
    setReload((value) => value + 1);
  }

  async function changeAssignee(task, userId) {
    if (savingAssigneeRef.current) return;
    savingAssigneeRef.current = true;
    setSavingAssignee(task.assignment_id);
    setAssignmentError('');
    setSuccess('');
    try {
      const { task: updated } = await updateTaskAssignee(task.assignment_id, Number(userId));
      setTaskRecords((records) => records.map((record) => record.assignment_id === updated.assignment_id ? updated : record));
      setSuccess(`"${updated.title}" assigned to ${updated.employee_name}.`);
    } catch (error) {
      setAssignmentError(error.message);
    } finally {
      savingAssigneeRef.current = false;
      setSavingAssignee(null);
    }
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

      {activeSectionId !== 'assignments' ? <TaskSectionRecords key={activeSectionId} section={activeSection} /> : <section
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

            {activeSectionId === 'assignments' && isManager && (
              <button
                type="button"
                className="btn btn-success flex-shrink-0"
                onClick={() => { setSuccess(''); setShowTaskModal(true); }}
                disabled={loading || savingAssignee !== null}
              >
                Add Task
              </button>
            )}
          </div>

          {activeSectionId === 'assignments' && <>
            {success && <div className="alert alert-success" role="status">{success}</div>}
            {loadError && <div className="alert alert-danger" role="alert">{loadError}</div>}
            {assignmentError && <div className="alert alert-danger" role="alert">{assignmentError}</div>}
            <button type="button" className="btn btn-outline-secondary btn-sm mb-3" disabled={loading || savingAssignee !== null} onClick={refreshTasks}>
              {loading ? 'Loading...' : 'Refresh tasks'}
            </button>
          </>}
          {!loading && !loadError && <p className="small text-secondary mb-3" role="status">Showing {taskRecords.length} saved {taskRecords.length === 1 ? 'task' : 'tasks'}.</p>}
          <div className="table-responsive task-table-scroll" role="region" aria-label="Task assignments table" tabIndex={0}>
            <table className="table table-hover align-middle mb-0 task-records-table">
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
                      <td className="task-table-text"><div>{record.title}</div>{record.description && <div className="small text-secondary mt-1">{record.description}</div>}</td>
                     <td>
                        {isManager ? (
                          <>
                            <select
                              className="form-select form-select-sm"
                              style={{ minWidth: 220, maxWidth: 320 }}
                              aria-label={`Assigned user for ${record.title}`}
                              value={
                                users.find(
                                  (assignedUser) =>
                                    assignedUser.employee_id === record.employee_id,
                                )?.user_id || ''
                              }
                              disabled={
                                loading ||
                                savingAssignee !== null ||
                                !users.length
                              }
                              onChange={(event) =>
                                changeAssignee(record, event.target.value)
                              }
                            >
                              <option value="" disabled>
                                Select a user
                              </option>

                              {users.map((assignedUser) => (
                                <option
                                  key={assignedUser.user_id}
                                  value={assignedUser.user_id}
                                >
                                  {assignedUser.full_name} ({assignedUser.username})
                                </option>
                              ))}
                            </select>

                            {savingAssignee === record.assignment_id && (
                              <span className="small text-secondary" role="status">
                                Saving...
                              </span>
                            )}

                            {!loading && !users.length && (
                              <span className="small text-secondary">
                                No active registered users.
                              </span>
                            )}
                          </>
                        ) : (
                          record.employee_name || '—'
                        )}
                      </td>
                      <td>{record.assigned_date || '—'}</td>
                      <td>{record.due_time || '—'}</td>
                      <td><TaskBadge value={record.priority} /></td>
                      <td><TaskBadge value={record.status} /></td>
                      <td className="task-table-text">{record.completion_note || '—'}</td>
                      <td><button type="button" className="btn btn-outline-primary btn-sm" disabled={loading || savingAssignee !== null}
                        aria-label={`Update progress for ${record.title}`}
                        onClick={() => { setSuccess(''); setProgressTask(record); }}>Update Progress</button></td>
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
      </section>}

      {showTaskModal && <AddTaskModal onClose={() => setShowTaskModal(false)} onSaved={handleSaved} />}
      {progressTask && <TaskProgressModal task={progressTask} onClose={() => setProgressTask(null)} onSaved={(updated) => {
        setTaskRecords((records) => records.map((record) => record.assignment_id === updated.assignment_id ? updated : record));
        setSuccess(`Progress for "${updated.title}" saved successfully.`);
        setProgressTask(null);
      }} />}

    </div>
  );
}

export default TaskHandover;
