
function validateTaskTransfer(body) {
  const input =
    body && typeof body === 'object' && !Array.isArray(body)
      ? body
      : {};

  const errors = {};

  function validId(value) {
    return Number.isInteger(value) &&
      value > 0 &&
      value <= 2147483647;
  }

  if (!validId(input.user_id)) {
    errors.user_id = 'Select a valid receiving employee.';
  }

  if (!validId(input.shift_type_id)) {
    errors.shift_type_id = 'Select a valid receiving shift.';
  }

  const date = input.assigned_date;

  if (
    typeof date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
  ) {
    errors.assigned_date = 'Select a valid transfer date.';
  } else {
    const [year, month, day] = date.split('-').map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));

    if (
      year < 100 ||
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() + 1 !== month ||
      parsed.getUTCDate() !== day
    ) {
      errors.assigned_date = 'Select a valid transfer date.';
    }
  }

  return {
    errors,
    value: {
      user_id: input.user_id,
      shift_type_id: input.shift_type_id,
      assigned_date: input.assigned_date,
    },
  };
}

module.exports = { validateTaskTransfer };
