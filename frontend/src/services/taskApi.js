const baseUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${baseUrl}/tasks${path}`, options);
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Unable to reach the server. Check your connection and try again.');
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
export const getTaskOptions = (signal) => request('/options', { signal });
export const createTask = (task) => request('', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(task),
});
