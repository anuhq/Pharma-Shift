
import { API_BASE_URL } from './config';

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
    const error = new Error(
      data.message || 'Attendance request failed.'
    );

    error.status = response.status;
    throw error;
  }

  return data;
}

// READ - Retrieve attendance records from MySQL.
export function getAttendanceRecords() {
  return attendanceRequest('/api/attendance');
}

// CREATE - Check in the signed-in employee.
export function checkIn() {
  return attendanceRequest('/api/attendance/check-in', {
    method: 'POST',
  });
}

// UPDATE - Check out the signed-in employee.
export function checkOut() {
  return attendanceRequest('/api/attendance/check-out', {
    method: 'POST',
  });
}

// UPDATE - Owner/Manager corrects an attendance record.
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

// DELETE - Permanently remove an attendance record.
// Only Owner/Manager is authorized by the backend.
export function deleteAttendanceRecord(attendanceId) {
  const id = Number(attendanceId);

  if (
    !Number.isSafeInteger(id) ||
    id < 1 ||
    id > 2147483647
  ) {
    throw new Error('Invalid attendance record ID.');
  }

  return attendanceRequest(
    `/api/attendance/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
    }
  );
}
