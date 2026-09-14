function validateProgress(body) {
  const input = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const errors = {};
  if (!['Assigned', 'In Progress', 'Completed'].includes(input.status)) {
    errors.status = 'Select Assigned, In Progress or Completed.';
  }
  const note = input.completion_note;
  if (note != null && (typeof note !== 'string' || note.trim().length > 255)) {
    errors.completion_note = 'Use up to 255 characters for the progress note.';
  }
  return {
    errors,
    value: { status: input.status, completion_note: typeof note === 'string' ? note.trim() || null : null },
  };
}

module.exports = { validateProgress };
