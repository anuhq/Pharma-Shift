import { Navigate, Route, Routes } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import Dashboard from './pages/Dashboard';
import EmployeeShift from './pages/EmployeeShift';
import AttendanceLeaveOvertime from './pages/AttendanceLeaveOvertime';
import TaskHandover from './pages/TaskHandover';
import IncidentCorrectiveAction from './pages/IncidentCorrectiveAction';

function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Dashboard />} />

        <Route
          path="/employee-shift"
          element={<EmployeeShift />}
        />

        <Route
          path="/attendance-leave-overtime"
          element={<AttendanceLeaveOvertime />}
        />

        <Route
          path="/task-handover"
          element={<TaskHandover />}
        />

        <Route
          path="/incident-corrective-action"
          element={<IncidentCorrectiveAction />}
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;