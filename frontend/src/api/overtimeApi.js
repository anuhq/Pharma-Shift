
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

// READ — Retrieve overtime records from MySQL.
export function getOvertimeRecords() {
  return overtimeRequest();
}
