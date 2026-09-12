function validateTask(body) {
  const input = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const errors = {};
  const id = (value) => Number.isInteger(value) && value > 0 && value <= 2147483647;
  const template_id = input.template_id ?? null;
  const employee_id = input.employee_id ?? null;
  const shift_type_id = input.shift_type_id ?? null;
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const description = typeof input.description === 'string' ? input.description.trim() : '';
  if (template_id !== null && !id(template_id)) errors.template_id = 'Select a valid template.';
  if (template_id === null && (!title || title.length > 100)) errors.title = 'Enter a task name of 1–100 characters.';
  if (description.length > 255 || (input.description != null && typeof input.description !== 'string')) errors.description = 'Use up to 255 characters.';
  if ((employee_id === null) === (shift_type_id === null)) errors.assignee = 'Select either an employee or a shift.';
  if (employee_id !== null && !id(employee_id)) errors.employee_id = 'Select a valid employee.';
  if (shift_type_id !== null && !id(shift_type_id)) errors.shift_type_id = 'Select a valid shift.';
  const date = input.assigned_date;
  const parsed = typeof date === 'string' ? new Date(`${date}T00:00:00Z`) : new Date(NaN);
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < '1000-01-01' || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) errors.assigned_date = 'Enter a valid date.';
  const due_time = input.due_time || null;
  if (due_time !== null && (typeof due_time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(due_time))) errors.due_time = 'Enter a valid time (HH:mm).';
  if (!['Low', 'Medium', 'High'].includes(input.priority)) errors.priority = 'Select Low, Medium or High priority.';
  return { errors, value: { template_id, employee_id, shift_type_id, title, description, assigned_date: date, due_time, priority: input.priority } };
}

module.exports = { validateTask };
