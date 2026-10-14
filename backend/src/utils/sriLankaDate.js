
function getSriLankaToday() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const dateParts = {};

  for (const part of parts) {
    dateParts[part.type] = part.value;
  }

  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
}

module.exports = { getSriLankaToday };
