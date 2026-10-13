
import { API_BASE_URL } from './config';

// READ - Generate a report using real MySQL data.
// Only Owner/Manager is authorized by the backend.
export async function generateReport(
  reportType,
  fromDate,
  toDate
) {
  const params = new URLSearchParams({
    type: reportType,
    from: fromDate,
    to: toDate,
  });

  const response = await fetch(
    `${API_BASE_URL}/api/reports?${params.toString()}`,
    {
      method: 'GET',
      credentials: 'include',
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      data.message || 'Unable to generate report.'
    );

    error.status = response.status;
    throw error;
  }

  return data;
}
