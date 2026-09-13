import { useState } from 'react';
import ModuleSectionNav from '../components/attendance/ModuleSectionNav';
import AttendanceRecords from '../components/attendance/AttendanceRecords';
import LeaveRequests from '../components/attendance/LeaveRequests';
import OvertimeRecords from '../components/attendance/OvertimeRecords';
import ReportsPreview from '../components/attendance/ReportsPreview';

const sections = [
  {
    id: 'attendance',
    label: 'Attendance',
    title: 'Attendance records',
    description:
      'Review daily check-ins, check-outs and attendance corrections.',
  },
  {
    id: 'leave',
    label: 'Leave',
    title: 'Leave requests',
    description:
      'Submit leave requests and review their approval status.',
  },
  {
    id: 'overtime',
    label: 'Overtime',
    title: 'Overtime records',
    description:
      'View and manage employee overtime records.',
  },
  {
    id: 'reports',
    label: 'Reports',
    title: 'Reports',
    description:
      'Attendance, leave and overtime summaries will be available in a future update.',
  },
];

function AttendanceLeaveOvertime() {
  const [activeSection, setActiveSection] = useState('attendance');

  const selectedSection = sections.find(
    (section) => section.id === activeSection
  );

  return (
    <div>
      <div className="mb-4">
        <h2 className="mb-1">
          Attendance, Leave &amp; Overtime
        </h2>

        <p className="mb-0">
          Manage attendance, leave requests and overtime records.
        </p>
      </div>

      <ModuleSectionNav
        sections={sections}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
      />

      <section
        id="attendance-module-section"
        className="card border-0 shadow-sm"
        aria-labelledby="attendance-module-section-title"
      >
        <div className="card-body p-4">
          <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
            <h3
              id="attendance-module-section-title"
              className="h5 mb-0"
            >
              {selectedSection.title}
            </h3>

            <span
  className={`badge ${
    activeSection === 'attendance'
      ? 'text-bg-success'
      : 'text-bg-secondary'
  }`}
>
  {activeSection === 'attendance'
    ? 'Live data'
    : ['leave', 'overtime'].includes(activeSection)
      ? 'Demo data'
      : 'Coming soon'}
</span>
          </div>

          <p className="mb-0">
            {selectedSection.description}
          </p>

          {/* Keep changes when switching tabs. */}
          <div hidden={activeSection !== 'attendance'}>
            <AttendanceRecords />
          </div>

          <div hidden={activeSection !== 'leave'}>
            <LeaveRequests />
          </div>

          <div hidden={activeSection !== 'overtime'}>
            <OvertimeRecords />
          </div>

          <div hidden={activeSection !== 'reports'}>
            <ReportsPreview />
          </div>
        </div>
      </section>
    </div>
  );
}

export default AttendanceLeaveOvertime;
