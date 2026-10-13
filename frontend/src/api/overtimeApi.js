
import { API_BASE_URL } from './config';

// Send requests to the Overtime backend API.
async function overtimeRequest(path = '', options = {}) {
  const response = await fetch(
    `${API_BASE_URL}/api/overtime${path}`,
    {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      ...options,
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      data.message || 'Unable to process overtime request.'
    );

    error.status = response.status;
    throw error;
  }

  return data;
}

// READ: Retrieve overtime records from MySQL.
export function getOvertimeRecords() {
  return overtimeRequest();
}

// READ: Retrieve active employees eligible for overtime.
// Only the Owner/Manager can access this endpoint.
export function getEligibleOvertimeEmployees() {
  return overtimeRequest('/eligible-employees');
}

// CREATE: Save an Approved overtime record.
// Only the Owner/Manager can perform this action.
export function createOvertimeRecord(data) {
  return overtimeRequest('', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// UPDATE: Edit an existing Approved overtime record.
// The backend checks permissions and employee eligibility.
export function updateOvertimeRecord(overtimeId, data) {
  if (
    !Number.isSafeInteger(overtimeId) ||
    overtimeId < 1
  ) {
    throw new Error('Invalid overtime record ID.');
  }

  return overtimeRequest(`/${overtimeId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// DELETE: Permanently delete an overtime record.
// The backend enforces Owner/Manager permission.
export function deleteOvertimeRecord(overtimeId) {
  if (
    !Number.isSafeInteger(overtimeId) ||
    overtimeId < 1
  ) {
    throw new Error('Invalid overtime record ID.');
  }

  return overtimeRequest(`/${overtimeId}`, {
    method: 'DELETE',
  });
}
