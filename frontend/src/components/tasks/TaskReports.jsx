
import { useEffect, useState } from 'react';
import { jsPDF } from 'jspdf';
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
    const record = records?.find(
      (item) => item.status === status
    );
    return Number(record?.total || 0);
  }

  const totalTasks = taskStatuses.reduce(
    (total, status) =>
      total + getCount(summary?.tasks, status),
    0
  );

  const totalHandovers = handoverStatuses.reduce(
    (total, status) =>
      total + getCount(summary?.handovers, status),
    0
  );

  // Generate a PDF using the current MySQL-backed report summary.
  function downloadPdf() {
    if (!summary || loading || error) {
      return;
    }

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const now = new Date();

    // Report heading.
    pdf.setFillColor(23, 62, 91);
    pdf.rect(0, 0, 210, 39, 'F');

    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(20);
    pdf.text('PharmaShift', 16, 17);

    pdf.setFontSize(12);
    pdf.text(
      'Daily Task & Shift Handover Report',
      16,
      27
    );

    // Generation date.
    pdf.setTextColor(70, 70, 70);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);

    pdf.text(
      `Generated: ${now.toLocaleString('en-GB')}`,
      16,
      50
    );

    // Draw one report summary table.
    function drawSection(
      title,
      statuses,
      records,
      total,
      startY
    ) {
      pdf.setFillColor(238, 243, 247);
      pdf.roundedRect(
        16,
        startY,
        178,
        10,
        2,
        2,
        'F'
      );

      pdf.setTextColor(25, 45, 65);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.text(title, 20, startY + 7);

      let y = startY + 18;

      pdf.setFontSize(10);
      pdf.text('Status', 22, y);
      pdf.text('Count', 187, y, {
        align: 'right',
      });

      pdf.setDrawColor(190, 200, 210);
      pdf.line(20, y + 2, 190, y + 2);

      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(45, 45, 45);

      statuses.forEach((status) => {
        y += 9;

        pdf.text(status, 22, y);
        pdf.text(
          String(getCount(records, status)),
          187,
          y,
          { align: 'right' }
        );
      });

      y += 10;

      pdf.setDrawColor(190, 200, 210);
      pdf.line(20, y - 7, 190, y - 7);

      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(25, 45, 65);
      pdf.text('Total', 22, y);
      pdf.text(String(total), 187, y, {
        align: 'right',
      });

      return y + 17;
    }

    // Task report.
    let nextY = drawSection(
      'Task Assignments',
      taskStatuses,
      summary.tasks,
      totalTasks,
      60
    );

    // Handover report.
    nextY = drawSection(
      'Shift Handovers',
      handoverStatuses,
      summary.handovers,
      totalHandovers,
      nextY
    );

    // Footer.
    pdf.setDrawColor(210, 215, 220);
    pdf.line(16, 282, 194, 282);

    pdf.setTextColor(110, 110, 110);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);

    pdf.text(
      'Generated from the PharmaShift report summary.',
      16,
      288
    );

    pdf.text(
      'Page 1 of 1',
      194,
      288,
      { align: 'right' }
    );

    // Download filename.
    const datePart = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-');

    pdf.save(
      `PharmaShift_Task_Handover_Report_${datePart}.pdf`
    );
  }

  return (
    <section className="card shadow-sm border-0 mt-4">
      <div className="card-body p-4">
        <div className="d-flex justify-content-between align-items-center gap-3 mb-4">
          <div>
            <h3 className="h5 mb-1">
              Task & Handover Reports
            </h3>
            <p className="text-muted small mb-0">
              Current task and shift handover statistics.
            </p>
          </div>

          <div className="d-flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-outline-success btn-sm"
              onClick={downloadPdf}
              disabled={!summary || loading || Boolean(error)}
            >
              Download PDF
            </button>

            <button
              type="button"
              className="btn btn-outline-primary btn-sm"
              onClick={() =>
                setRefresh((value) => value + 1)
              }
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>

        {error && (
          <div
            className="alert alert-danger"
            role="alert"
          >
            {error}
          </div>
        )}

        {loading && !summary && (
          <p className="text-muted">
            Loading reports...
          </p>
        )}

        {summary && (
          <div className="row g-4">
            <div className="col-md-6">
              <div className="border rounded p-3 h-100">
                <h4 className="h6">
                  Task Assignments
                </h4>

                <p className="fs-4 fw-bold mb-3">
                  {totalTasks}
                </p>

                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th scope="col">Status</th>
                      <th
                        scope="col"
                        className="text-end"
                      >
                        Total
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {taskStatuses.map((status) => (
                      <tr key={status}>
                        <td>{status}</td>
                        <td className="text-end">
                          {getCount(
                            summary.tasks,
                            status
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="col-md-6">
              <div className="border rounded p-3 h-100">
                <h4 className="h6">
                  Shift Handovers
                </h4>

                <p className="fs-4 fw-bold mb-3">
                  {totalHandovers}
                </p>

                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th scope="col">Status</th>
                      <th
                        scope="col"
                        className="text-end"
                      >
                        Total
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {handoverStatuses.map((status) => (
                      <tr key={status}>
                        <td>{status}</td>
                        <td className="text-end">
                          {getCount(
                            summary.handovers,
                            status
                          )}
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
