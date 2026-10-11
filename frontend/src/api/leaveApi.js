
import { API_BASE_URL } from './config';

async function leaveRequest(options = {}) {
  const response = await fetch(`${API_BASE_URL}/api/leave`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'Leave request failed.');
  }

  return data;
}

// READ - Get leave requests from MySQL
export function getLeaveRequests() {
  return leaveRequest();
}

// CREATE - Submit a new leave request
export function submitLeaveRequest(values) {
  return leaveRequest({
    method: 'POST',
    body: JSON.stringify(values),
  });
}

// UPDATE - Edit an existing Pending leave request
export async function updateLeaveRequest(leaveId, values) {
  const response = await fetch(
    `${API_BASE_URL}/api/leave/${encodeURIComponent(leaveId)}`,
    {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(values),
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.message || 'Unable to update leave request.'
    );
  }

  return data;
}

// CANCEL - Cancel an existing Pending leave request
export async function cancelLeaveRequest(leaveId) {
  const response = await fetch(
    `${API_BASE_URL}/api/leave/${encodeURIComponent(leaveId)}/cancel`,
    {
      method: 'PATCH',
      credentials: 'include',
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.message || 'Unable to cancel leave request.'
    );
  }

  return data;
}


export async function reviewLeaveRequest(
  leaveId,
  decision,
  reviewNote = ''
) {
  const response = await fetch(
    `${API_BASE_URL}/api/leave/${encodeURIComponent(leaveId)}/review`,
    {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        decision,
        review_note: reviewNote,
      }),
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.message || 'Unable to review leave request.'
    );
  }

  return data;
}