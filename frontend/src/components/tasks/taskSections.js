const priority = { name: 'priority', label: 'Priority', type: 'select', choices: ['Low', 'Medium', 'High'], initial: 'Medium' };
const shift = { name: 'shift_type_id', label: 'Shift', type: 'select', source: 'shifts', id: 'shift_type_id', display: 'shift_name' };

export const taskSections = {
  templates: {
    label: 'Task Template', id: 'template_id', status: 'Active',
    fields: [
      { name: 'template_name', label: 'Template name', maxLength: 100 },
      { name: 'description', label: 'Instructions', type: 'textarea', maxLength: 255, optional: true },
      { name: 'checklist_id', label: 'Checklist', type: 'select', source: 'checklists', id: 'checklist_id', display: 'checklist_name', optional: true },
      priority,
    ],
    columns: [['template_name', 'Template'], ['description', 'Instructions'], ['checklist_name', 'Checklist'], ['priority', 'Priority'], ['status', 'Status']],
  },
  checklists: {
    label: 'Checklist', id: 'checklist_id', status: 'Active',
    fields: [
      { name: 'checklist_name', label: 'Checklist name', maxLength: 100 }, shift,
      { name: 'frequency', label: 'Frequency', maxLength: 50, placeholder: 'e.g. Daily, Weekly or Every shift' },
    ],
    columns: [['checklist_name', 'Checklist'], ['shift_name', 'Shift'], ['frequency', 'Frequency'], ['status', 'Status']],
  },
  handovers: {
    label: 'Shift Handover', id: 'handover_id', status: 'Open',
    fields: [
      { name: 'employee_id', label: 'Recorded by', type: 'select', source: 'employees', id: 'employee_id', display: 'full_name' },
      { ...shift, name: 'to_shift_type_id', label: 'Next shift' },
      { name: 'handover_date', label: 'Handover date', type: 'date' }, priority,
      { name: 'notes', label: 'Handover notes', type: 'textarea', maxLength: 500 },
    ],
    columns: [['employee_name', 'Recorded By'], ['shift_name', 'Next Shift'], ['handover_date', 'Date'], ['notes', 'Notes'], ['priority', 'Priority'], ['status', 'Status']],
  },
};
