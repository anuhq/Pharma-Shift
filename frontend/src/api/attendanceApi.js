const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000';

async function attendanceRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || 'Attendance request failed.');
    error.status = response.status;
    throw error;
  }

  return data;
}

export function getAttendanceRecords() {
  return attendanceRequest('/api/attendance');
}

export function checkIn() {
  return attendanceRequest('/api/attendance/check-in', {
    method: 'POST',
  });
}

export function checkOut() {
  return attendanceRequest('/api/attendance/check-out', {
    method: 'POST',
  });
}

export function correctAttendance(attendanceId, changes) {
  // Only managers are allowed to use this endpoint.
  return attendanceRequest(`/api/attendance/${attendanceId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      checkInTime: changes.check_in_time,
      checkOutTime: changes.check_out_time,
      correctionNote: changes.correction_note,
    }),
  });
}