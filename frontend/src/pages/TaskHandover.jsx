import { useState } from 'react';

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
  const [taskFormData, setTaskFormData] = useState({
    task: '',
    assignedTo: '',
    date: '',
    dueTime: '',
    priority: 'Medium',
    status: 'Pending',
  });

  const activeSection = sections.find(
    (section) => section.id === activeSectionId,
  );

  const handleOpenTaskModal = () => {
    setShowTaskModal(true);
  };

  const handleCloseTaskModal = () => {
    setShowTaskModal(false);
    setTaskFormData({
      task: '',
      assignedTo: '',
      date: '',
      dueTime: '',
      priority: 'Medium',
      status: 'Pending',
    });
  };

  const handleTaskFormChange = (event) => {
    const { name, value } = event.target;

    setTaskFormData((currentData) => ({
      ...currentData,
      [name]: value,
    }));
  };

  const handleSaveTask = (event) => {
    event.preventDefault();

    setTaskRecords((currentRecords) => [
      {
        id: Date.now(),
        task: taskFormData.task,
        assignedTo: taskFormData.assignedTo,
        date: taskFormData.date,
        dueTime: taskFormData.dueTime,
        priority: taskFormData.priority,
        status: taskFormData.status,
      },
      ...currentRecords,
    ]);

    handleCloseTaskModal();
  };

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
                onClick={handleOpenTaskModal}
              >
                Add Task
              </button>
            )}
          </div>

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
                    <tr key={record.id}>
                      <td>{record.task}</td>
                      <td>{record.assignedTo}</td>
                      <td>{record.date || '—'}</td>
                      <td>{record.dueTime || '—'}</td>
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
                      Records have not been loaded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {showTaskModal && (
        <>
          <div
            className="modal fade show d-block"
            tabIndex="-1"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-task-modal-title"
          >
            <div className="modal-dialog modal-lg modal-dialog-centered" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h4 id="add-task-modal-title" className="modal-title">
                    Add Task
                  </h4>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Close"
                    onClick={handleCloseTaskModal}
                  ></button>
                </div>

                <form onSubmit={handleSaveTask}>
                  <div className="modal-body">
                    <div className="row g-3">
                      <div className="col-md-6">
                        <label htmlFor="task" className="form-label">
                          Task
                        </label>
                        <input
                          id="task"
                          name="task"
                          type="text"
                          className="form-control"
                          placeholder="Enter task name"
                          value={taskFormData.task}
                          onChange={handleTaskFormChange}
                          required
                        />
                      </div>

                      <div className="col-md-6">
                        <label htmlFor="assignedTo" className="form-label">
                          Assigned To
                        </label>
                        <input
                          id="assignedTo"
                          name="assignedTo"
                          type="text"
                          className="form-control"
                          placeholder="Enter employee or shift"
                          value={taskFormData.assignedTo}
                          onChange={handleTaskFormChange}
                          required
                        />
                      </div>

                      <div className="col-md-6">
                        <label htmlFor="date" className="form-label">
                          Date
                        </label>
                        <input
                          id="date"
                          name="date"
                          type="date"
                          className="form-control"
                          value={taskFormData.date}
                          onChange={handleTaskFormChange}
                        />
                      </div>

                      <div className="col-md-6">
                        <label htmlFor="dueTime" className="form-label">
                          Due Time
                        </label>
                        <input
                          id="dueTime"
                          name="dueTime"
                          type="time"
                          className="form-control"
                          value={taskFormData.dueTime}
                          onChange={handleTaskFormChange}
                        />
                      </div>

                      <div className="col-md-6">
                        <label htmlFor="priority" className="form-label">
                          Priority
                        </label>
                        <select
                          id="priority"
                          name="priority"
                          className="form-select"
                          value={taskFormData.priority}
                          onChange={handleTaskFormChange}
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                        </select>
                      </div>

                      <div className="col-md-6">
                        <label htmlFor="status" className="form-label">
                          Status
                        </label>
                        <select
                          id="status"
                          name="status"
                          className="form-select"
                          value={taskFormData.status}
                          onChange={handleTaskFormChange}
                        >
                          <option value="Pending">Pending</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Completed">Completed</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="modal-footer">
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={handleCloseTaskModal}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-success">
                      Save Task
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>

          <div
            className="modal-backdrop fade show"
            onClick={handleCloseTaskModal}
          ></div>
        </>
      )}
    </div>
  );
}

export default TaskHandover;