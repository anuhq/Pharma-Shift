const colors = {
  Active: 'text-bg-success',
  Completed: 'text-bg-success',
  Assigned: 'text-bg-primary',
  'In Progress': 'text-bg-warning',
  Pending: 'text-bg-warning',
  Open: 'text-bg-warning',
  Inactive: 'text-bg-secondary',
  High: 'text-bg-danger',
  Medium: 'text-bg-warning',
  Low: 'text-bg-success',
};

export default function TaskBadge({ value }) {
  return <span className={`badge ${colors[value] || 'text-bg-secondary'}`}>{value || 'Unknown'}</span>;
}
