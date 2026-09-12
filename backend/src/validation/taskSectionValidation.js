function validateSection(section, body) {
  const input = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const errors = {};
  const value = {};
  function text(field, label, max, required = true) {
    const raw = input[field];
    value[field] = typeof raw === 'string' ? raw.trim() : '';
    if ((required && !value[field]) || value[field].length > max || (raw != null && typeof raw !== 'string')) errors[field] = `${label} must contain ${required ? '1' : '0'}–${max} characters.`;
  }
  function reference(field, label, optional = false) {
    value[field] = input[field] ?? null;
    if (optional && value[field] === null) return;
    if (!Number.isInteger(value[field]) || value[field] < 1 || value[field] > 2147483647) errors[field] = `Select a valid ${label}.`;
  }
  function priority() {
    value.priority = input.priority;
    if (!['Low', 'Medium', 'High'].includes(value.priority)) errors.priority = 'Select a valid priority.';
  }
  if (section === 'templates') {
    text('template_name', 'Template name', 100);
    text('description', 'Instructions', 255, false);
    reference('checklist_id', 'checklist', true);
    priority();
    value.status = 'Active';
  } else if (section === 'checklists') {
    text('checklist_name', 'Checklist name', 100);
    reference('shift_type_id', 'shift');
    text('frequency', 'Frequency', 50);
    value.status = 'Active';
  } else if (section === 'handovers') {
    reference('employee_id', 'employee');
    reference('to_shift_type_id', 'next shift');
    text('notes', 'Handover notes', 500);
    priority();
    const date = input.handover_date;
    const parsed = typeof date === 'string' ? new Date(`${date}T00:00:00Z`) : new Date(NaN);
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < '1000-01-01' || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) errors.handover_date = 'Enter a valid handover date.';
    value.handover_date = date;
    value.status = 'Open';
  } else {
    errors.section = 'Unknown section.';
  }
  return { value, errors };
}

module.exports = { validateSection };
