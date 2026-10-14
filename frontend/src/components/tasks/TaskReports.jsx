
import { useEffect, useState } from 'react';
import { getTaskReportSummary } from '../../services/taskApi';


const taskStatuses = [
  'Assigned',
  'In Progress',
  'Completed',
  'Cancelled',
  'Transferred',
];


const handoverStatuses = ['Open', 'Completed'];

function TaskReports() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadReports() {
      setLoading(true);
      setError('');

      try {
        const data = await getTaskReportSummary(controller.signal);
        setSummary(data.summary);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Unable to load reports.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadReports();

    return () => controller.abort();
  }, [refresh]);

  function getCount(records, status) {
    const record = records?.find((item) => item.status === status);
    return Number(record?.total || 0);
  }

  const totalTasks = taskStatuses.reduce(
    (total, status) => total + getCount(summary?.tasks, status),
    0
  );

  const totalHandovers = handoverStatuses.reduce(
    (total, status) => total + getCount(summary?.handovers, status),
    0
  );

  return (
    <section className="card shadow-sm border-0 mt-4">
      <div className="card-body p-4">
        <div className="d-flex justify-content-between align-items-center gap-3 mb-4">
          <div>
            <h3 className="h5 mb-1">Task & Handover Reports</h3>
            <p className="text-muted small mb-0">
              Current task and shift handover statistics.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            onClick={() => setRefresh((value) => value + 1)}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}

        {loading && !summary && (
          <p className="text-muted">Loading reports...</p>
        )}

        {summary && (
          <div className="row g-4">
            <div className="col-md-6">
              <div className="border rounded p-3 h-100">
                <h4 className="h6">Task Assignments</h4>
                <p className="fs-4 fw-bold mb-3">{totalTasks}</p>

                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th scope="col">Status</th>
                      <th scope="col" className="text-end">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {taskStatuses.map((status) => (
                      <tr key={status}>
                        <td>{status}</td>
                        <td className="text-end">
                          {getCount(summary.tasks, status)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="col-md-6">
              <div className="border rounded p-3 h-100">
                <h4 className="h6">Shift Handovers</h4>
                <p className="fs-4 fw-bold mb-3">{totalHandovers}</p>

                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th scope="col">Status</th>
                      <th scope="col" className="text-end">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {handoverStatuses.map((status) => (
                      <tr key={status}>
                        <td>{status}</td>
                        <td className="text-end">
                          {getCount(summary.handovers, status)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default TaskReports;
