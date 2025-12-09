import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ApiCacheProvider } from './contexts/ApiCacheContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PendingTasks from './pages/PendingTasks';
import MasterTasks from './pages/MasterTasks';
import AssignTask from './pages/AssignTask';
import AdminPanel from './pages/AdminPanel';
import ProtectedRoute from './components/ProtectedRoute';
import Performance from './pages/Performance';
import DetailedPerformance from './pages/DetailedPerformance';
import CreateFMS from './pages/CreateFMS';
import ViewAllFMS from './pages/ViewAllFMS';
import StartProject from './pages/StartProject';
import ViewFMSProgress from './pages/ViewFMSProgress';
import AssignedByMe from './pages/AssignedByMe';
import AuditLogs from './pages/AuditLogs';
import ScoreLogs from './pages/ScoreLogs';
import AdminTasks from './pages/AdminTasks';
import ObjectionApprovals from './pages/ObjectionApprovals';
import ObjectionsHub from './pages/ObjectionsHub';
import ErrorBoundary from './components/ErrorBoundary';
import Checklists from './pages/Checklists';
import CreateChecklist from './pages/CreateChecklist';
import ChecklistDetail from './pages/ChecklistDetail';
import HelpTickets from './pages/HelpTickets';
import AdminHelpTickets from './pages/AdminHelpTickets';
import Complaints from './pages/Complaints';
import ComplaintsDashboard from './pages/ComplaintsDashboard';
import PurchaseDashboard from './pages/PurchaseDashboard';
import SalesDashboard from './pages/SalesDashboard';
import StationeryRequestForm from './pages/StationeryRequestForm';
import MyStationeryRequests from './pages/MyStationeryRequests';
import CategoryManagement from './pages/CategoryManagement';
import ChecklistCalendar from './pages/ChecklistCalendar';
import ChecklistTemplateForm from './pages/ChecklistTemplateForm';
import ChecklistOccurrenceDetail from './pages/ChecklistOccurrenceDetail';
import PendingChecklists from './pages/PendingChecklists';
import ChecklistPersonDashboard from './pages/ChecklistPersonDashboard';
import ChecklistMaster from './pages/ChecklistMaster';
import FMSDashboard from './pages/FMSDashboard';
import SuperAdminManagement from './pages/SuperAdminManagement';
import Profile from './pages/Profile';
import MISReport from './pages/MISReport';
import UpdateNotification from './components/UpdateNotification';
import { useVersionCheck } from './hooks/useVersionCheck';

function AppContent() {
  const { hasUpdate, refreshApp } = useVersionCheck({
    checkInterval: 60000, // Check every minute
    enabled: true
  });

  return (
    <>
      {hasUpdate && <UpdateNotification onRefresh={refreshApp} />}
      <Router
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)', color: 'var(--color-text)' }}>
          <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="performance" element={<ProtectedRoute><Performance /></ProtectedRoute>} />
                  <Route path="performance/details" element={<ProtectedRoute><DetailedPerformance /></ProtectedRoute>} />
                  <Route path="pending-tasks" element={<ProtectedRoute requiredPermissions={['canViewTasks']}><PendingTasks /></ProtectedRoute>} />
                  <Route path="master-tasks" element={<ProtectedRoute requiredPermissions={['canViewTasks']}><MasterTasks /></ProtectedRoute>} />
                  <Route path="assign-task" element={<ProtectedRoute requiredPermissions={['canAssignTasks']}><AssignTask /></ProtectedRoute>} />
                  <Route path="fms-templates" element={<ProtectedRoute requiredPermissions={['canAssignTasks']}><ViewAllFMS /></ProtectedRoute>} />
                  <Route path="create-fms" element={<ProtectedRoute requiredPermissions={['canAssignTasks']}><CreateFMS /></ProtectedRoute>} />
                  <Route path="start-project" element={<ProtectedRoute requiredPermissions={['canAssignTasks']}><StartProject /></ProtectedRoute>} />
                  <Route path="fms-progress" element={<ProtectedRoute requiredPermissions={['canAssignTasks']}><ViewFMSProgress /></ProtectedRoute>} />
                  <Route path="fms-dashboard" element={<ProtectedRoute requiredPermissions={['canAssignTasks']}><FMSDashboard /></ProtectedRoute>} />
                  <Route path="profile" element={<Profile />} />
                  <Route path="/checklists" element={<ProtectedRoute><Checklists /></ProtectedRoute>} />
                  <Route path="/checklists/create" element={<ProtectedRoute><CreateChecklist /></ProtectedRoute>} />
                  <Route path="/checklists/:id" element={<ProtectedRoute><ChecklistDetail /></ProtectedRoute>} />
                  <Route path="/checklist-calendar" element={<ProtectedRoute><ChecklistCalendar /></ProtectedRoute>} />
                  <Route path="/checklist-template/create" element={<ProtectedRoute><ChecklistTemplateForm /></ProtectedRoute>} />
                  <Route path="/checklist-occurrence/:id" element={<ProtectedRoute><ChecklistOccurrenceDetail /></ProtectedRoute>} />
                  <Route path="/pending-checklists" element={<ProtectedRoute><PendingChecklists /></ProtectedRoute>} />
                  <Route path="/checklist-person-dashboard" element={<ProtectedRoute><ChecklistPersonDashboard /></ProtectedRoute>} />
                  <Route path="/checklist-master" element={<ProtectedRoute requireAdmin><ChecklistMaster /></ProtectedRoute>} />
                  <Route path="/help-tickets" element={<ProtectedRoute><HelpTickets /></ProtectedRoute>} />
                  <Route path="/admin-help-tickets" element={<ProtectedRoute requiredPermissions={['canViewAllComplaints']}><AdminHelpTickets /></ProtectedRoute>} />
                  <Route path="/complaints" element={<ProtectedRoute requiredPermissions={['canRaiseComplaints']}><Complaints /></ProtectedRoute>} />
                  <Route path="/complaints-dashboard" element={<ProtectedRoute requiredPermissions={['canViewAllComplaints']}><ComplaintsDashboard /></ProtectedRoute>} />
                  <Route path="/purchase-dashboard" element={<ProtectedRoute requireAdmin><PurchaseDashboard /></ProtectedRoute>} />
                  <Route path="/sales-dashboard" element={<ProtectedRoute requireAdmin><SalesDashboard /></ProtectedRoute>} />
                  <Route path="/stationery-request" element={<ProtectedRoute><StationeryRequestForm /></ProtectedRoute>} />
                  <Route path="/my-stationery-requests" element={<ProtectedRoute><MyStationeryRequests /></ProtectedRoute>} />
                  <Route path="assigned-by-me" element={<ProtectedRoute requiredPermissions={['canAssignTasks']}><AssignedByMe /></ProtectedRoute>} />
                  <Route path="audit-logs" element={<ProtectedRoute><AuditLogs /></ProtectedRoute>} />
                  <Route path="score-logs" element={<ProtectedRoute><ScoreLogs /></ProtectedRoute>} />
                  <Route path="objection-approvals" element={<ProtectedRoute requiredPermissions={['canApproveObjections']}><ObjectionApprovals /></ProtectedRoute>} />
                  <Route path="objections" element={<ProtectedRoute requiredPermissions={['canViewObjectionMaster']}><ObjectionsHub /></ProtectedRoute>} />
                  <Route path="admin-tasks" element={<ProtectedRoute requireAdmin><AdminTasks /></ProtectedRoute>} />
                  <Route path="admin" element={<ProtectedRoute requireAdmin><AdminPanel /></ProtectedRoute>} />
                  <Route path="fms-categories" element={<ProtectedRoute requireAdmin><CategoryManagement type="fms" /></ProtectedRoute>} />
                  <Route path="checklist-categories" element={<ProtectedRoute requireAdmin><CategoryManagement type="checklist" /></ProtectedRoute>} />
                  <Route path="super-admin-management" element={<ProtectedRoute requireSuperAdmin><SuperAdminManagement /></ProtectedRoute>} />
                  <Route path="mis-report" element={<ProtectedRoute requireSuperAdmin><MISReport /></ProtectedRoute>} />
                </Route>
          </Routes>
        </div>
      </Router>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ApiCacheProvider>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </ApiCacheProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;