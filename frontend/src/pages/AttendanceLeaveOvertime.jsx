
import { useState } from 'react';

import { useAuth } from '../auth/useAuth';

import ModuleSectionNav from '../components/attendance/ModuleSectionNav';
import AttendanceRecords from '../components/attendance/AttendanceRecords';
import LeaveRequests from '../components/attendance/LeaveRequests';
import OvertimeRecords from '../components/attendance/OvertimeRecords';
import Reports from '../components/attendance/Reports';

const allSections = [
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
      'Generate attendance, leave and overtime reports using saved records.',
  },
];

function AttendanceLeaveOvertime() {
  const { user } = useAuth();

  const isManager = user?.roleName === 'Owner/Manager';

  const [activeSection, setActiveSection] =
    useState('attendance');

  // This is the position for the active module's action button.
  const [headerActionContainer, setHeaderActionContainer] =
    useState(null);

  // Only Owner/Manager can access the Reports tab.
  const sections = allSections.filter(
    (section) =>
      isManager || section.id !== 'reports'
  );

  const selectedSection =
    sections.find(
      (section) => section.id === activeSection
    ) || sections[0];

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
        activeSection={selectedSection.id}
        onSectionChange={setActiveSection}
      />

      <section
        id="attendance-module-section"
        className="card border-0 shadow-sm"
        aria-labelledby="attendance-module-section-title"
      >
        <div className="card-body p-4">
          <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-2">
            <div className="flex-grow-1">
              <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                <h3
                  id="attendance-module-section-title"
                  className="h5 mb-0"
                >
                  {selectedSection.title}
                </h3>

                <span className="badge text-bg-success">
                  Live data
                </span>
              </div>

              <p className="mb-0">
                {selectedSection.description}
              </p>
            </div>

            {/* The active module renders its button here. */}
            <div
              ref={setHeaderActionContainer}
              className="flex-shrink-0"
            />
          </div>

          {/* Preserve module state when switching tabs. */}
          <div hidden={selectedSection.id !== 'attendance'}>
            <AttendanceRecords
              headerActionContainer={
                selectedSection.id === 'attendance'
                  ? headerActionContainer
                  : null
              }
            />
          </div>

          <div hidden={selectedSection.id !== 'leave'}>
            <LeaveRequests
              headerActionContainer={
                selectedSection.id === 'leave'
                  ? headerActionContainer
                  : null
              }
            />
          </div>

          <div hidden={selectedSection.id !== 'overtime'}>
            <OvertimeRecords
              headerActionContainer={
                selectedSection.id === 'overtime'
                  ? headerActionContainer
                  : null
              }
            />
          </div>

          {/* Reports remain accessible only to Owner/Manager. */}
          {isManager && (
            <div hidden={selectedSection.id !== 'reports'}>
              <Reports />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default AttendanceLeaveOvertime;
