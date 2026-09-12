import { Navigate, Route, Routes } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import EmployeeShift from './pages/EmployeeShift';
import AttendanceLeaveOvertime from './pages/AttendanceLeaveOvertime';
import TaskHandover from './pages/TaskHandover';
import IncidentCorrectiveAction from './pages/IncidentCorrectiveAction';
import Login from './pages/Login';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute />}>
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
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;