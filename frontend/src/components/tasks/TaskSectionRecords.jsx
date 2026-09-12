import { useEffect, useState } from 'react';
import { getTaskSection } from '../../services/taskApi';
import TaskSectionModal from './TaskSectionModal';
import { taskSections } from './taskSections';
import TaskBadge from './TaskBadge';

export default function TaskSectionRecords({ section }) {
  const config = taskSections[section.id];
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [reload, setReload] = useState(0);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getTaskSection(section.id, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setRecords(data.records); })
      .catch((err) => { if (!controller.signal.aborted) setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [section.id, reload]);

  function saved(record) {
    setRecords((current) => [record, ...current].sort((a, b) =>
      (section.id === 'handovers' ? b.handover_date.localeCompare(a.handover_date) : 0) || b[config.id] - a[config.id]));
    setShowModal(false);
    setSuccess(`${config.label} saved successfully.`);
  }

  return <>
    <section id="task-handover-content" className="card border-0 shadow-sm" aria-labelledby="task-handover-section-title">
      <div className="card-body p-4">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
          <div>
            <h3 id="task-handover-section-title" className="h5 mb-2">{section.title}</h3>
            <p className="text-muted mb-0">{section.description}</p>
          </div>
          <button type="button" className="btn btn-success flex-shrink-0" disabled={loading} onClick={() => { setSuccess(''); setShowModal(true); }}>Add {config.label}</button>
        </div>
        {success && <div className="alert alert-success" role="status">{success}</div>}
        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        <button type="button" className="btn btn-outline-secondary btn-sm mb-3" disabled={loading}
          onClick={() => { setLoading(true); setError(''); setReload((value) => value + 1); }}>{loading ? 'Loading...' : 'Refresh records'}</button>
        {!loading && !error && <p className="small text-secondary mb-3" role="status">Showing {records.length} saved {records.length === 1 ? 'record' : 'records'}.</p>}
        <div className="table-responsive task-table-scroll" role="region" aria-label={`${section.title} table`} tabIndex={0}>
          <table className="table table-hover align-middle mb-0 task-records-table">
            <caption className="visually-hidden">{section.title}</caption>
            <thead className="table-light"><tr>{config.columns.map(([field, label]) => <th key={field} scope="col">{label}</th>)}</tr></thead>
            <tbody>
              {records.map((record) => <tr key={record[config.id]}>
                {config.columns.map(([field]) => <td key={field} className={['template_name', 'checklist_name', 'description', 'notes'].includes(field) ? 'task-table-text' : undefined}>
                  {field === 'status' || field === 'priority' ? <TaskBadge value={record[field]} /> : record[field] || '—'}
                </td>)}
              </tr>)}
              {!records.length && <tr><td colSpan={config.columns.length} className="text-center text-muted py-5">
                {loading ? 'Loading records...' : error ? 'Records could not be loaded. Refresh to retry.' : `No records yet. Click Add ${config.label} to create one.`}
              </td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
    {showModal && <TaskSectionModal section={section.id} onClose={() => setShowModal(false)} onSaved={saved} />}
  </>;
}
