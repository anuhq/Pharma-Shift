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

  const activeSection = sections.find(
    (section) => section.id === activeSectionId,
  );

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
          <h3 id="task-handover-section-title" className="h5 mb-2">
            {activeSection.title}
          </h3>

          <p className="text-muted mb-4">
            {activeSection.description}
          </p>

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
                <tr>
                  <td
                    colSpan={activeSection.columns.length}
                    className="text-center text-muted py-5"
                  >
                    Records have not been loaded.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

export default TaskHandover;