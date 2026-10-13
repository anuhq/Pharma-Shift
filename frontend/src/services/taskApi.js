const baseUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${baseUrl}/tasks${path}`, {
  credentials: 'include',
  ...options,
});
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Unable to reach the server. Check your connection and try again.', { cause: error });
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    const error = new Error(data?.message || 'Unable to load or save tasks. Please try again.');
    error.errors = data?.errors;
    throw error;
  }
  return data;
}

export const getTasks = (signal) => request('', { signal });
export const updateTaskAssignee = (id, userId) => request(`/${id}/assignee`, {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId }),
});
export const updateTaskAssignment = (id, changes) =>
  request(`/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(changes),
  });
  export const cancelTaskAssignment = (id) =>
  request(`/${id}/cancel`, {
    method: 'PATCH',
  });
export const updateTaskProgress = (id, progress) => request(`/${id}/progress`, {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(progress),
});
export const getTaskSection = (section, signal) => request(`/${section}`, { signal });
export const createTaskSection = (section, record) => request(`/${section}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(record),
});
export const updateTaskSection = (section, id, record) =>
  request(`/${section}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  });
export const deactivateTaskSection = (section, id) =>
  request(`/${section}/${id}`, {
    method: 'DELETE',
  });
export const getTaskOptions = (signal) => request('/options', { signal });
export const createTask = (task) => request('', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(task),
});
export const getHandoverOptions = (signal) =>
  request('/handover-options', { signal });
export const completeTaskHandover = (id) =>
  request(`/handovers/${id}/complete`, {
    method: 'PATCH',
  });

export const getTaskReportSummary = (signal) =>
  request('/reports/summary', { signal });
