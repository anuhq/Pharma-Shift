function validateTask(body, now = new Date()) {
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
  if (!id(employee_id)) errors.employee_id = 'Select a registered user.';
  if (shift_type_id !== null) errors.shift_type_id = 'Tasks must be assigned to a registered user.';
  const date = input.assigned_date;
  const parsed = typeof date === 'string' ? new Date(`${date}T00:00:00Z`) : new Date(NaN);
  if (
    typeof date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    date < '2020-01-01' ||
    date > '2100-12-31' ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  ) {
    errors.assigned_date =
      'Enter a valid date between 2020 and 2100.';
  } else if (date < new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' }).format(now)) {
    errors.assigned_date = 'Task date cannot be before today. Select today or a future date.';
  }
  const due_time = input.due_time === '' || input.due_time == null ? null : input.due_time;
  if (due_time !== null && (typeof due_time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(due_time))) errors.due_time = 'Enter a valid time (HH:mm).';
  if (!['Low', 'Medium', 'High'].includes(input.priority)) errors.priority = 'Select Low, Medium or High priority.';
  return { errors, value: { template_id, employee_id, shift_type_id, title, description, assigned_date: date, due_time, priority: input.priority } };
}

module.exports = { validateTask, validateAssignmentEdit };
function validateAssignmentEdit(body, now = new Date()) {
  const input = body && typeof body === 'object' && !Array.isArray(body)
    ? body
    : {};

  const errors = {};
  const value = {};

  const allowed = ['assigned_date', 'due_time', 'priority'];
  const keys = Object.keys(input);

  if (
    keys.length === 0 ||
    keys.some((key) => !allowed.includes(key))
  ) {
    errors.fields = 'Only task date, due time and priority can be edited.';
  }

  if (Object.hasOwn(input, 'assigned_date')) {
    const date = input.assigned_date;
    const parsed = typeof date === 'string'
      ? new Date(`${date}T00:00:00Z`)
      : new Date(NaN);

    if (
      typeof date !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      date < '2020-01-01' ||
      date > '2100-12-31' ||
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== date
    ) {
      errors.assigned_date = 'Enter a valid task date.';
    } else {
      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Colombo',
      }).format(now);

      if (date < today) {
        errors.assigned_date = 'Task date cannot be before today.';
      } else {
        value.assigned_date = date;
      }
    }
  }

  if (Object.hasOwn(input, 'due_time')) {
    const dueTime = input.due_time === '' || input.due_time == null
      ? null
      : input.due_time;

    if (
      dueTime !== null &&
      (typeof dueTime !== 'string' ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(dueTime))
    ) {
      errors.due_time = 'Enter a valid time (HH:mm).';
    } else {
      value.due_time = dueTime;
    }
  }

  if (Object.hasOwn(input, 'priority')) {
    if (!['Low', 'Medium', 'High'].includes(input.priority)) {
      errors.priority = 'Select Low, Medium or High priority.';
    } else {
      value.priority = input.priority;
    }
  }

  return { errors, value };
}
