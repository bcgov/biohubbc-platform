import { SYSTEM_ROLE } from 'constants/roles';
import ManageUsersPage from 'features/admin/users/ManageUsersPage';
import { SystemRoleGuard } from 'guards/Guards';
import { AuthenticatedRouteGuard } from 'guards/RouteGuards';
import BaseLayout from 'layouts/BaseLayout';
import { Navigate, Route, Routes } from 'react-router-dom';
import { SubmissionsRouter } from './submission/SubmissionRouter';

export const AdminRouter = () => {
  return (
    <Routes>
      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />

      {/* Wrap all admin pages in layout */}
      <Route element={<BaseLayout />}>
        {/* Dashboard route */}
        <Route
          path="dashboard"
          element={
            <AuthenticatedRouteGuard>
              <SystemRoleGuard
                validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR]}
                fallback={<Navigate to="/forbidden" replace />}>
                <SubmissionsRouter />
              </SystemRoleGuard>
            </AuthenticatedRouteGuard>
          }
        />

        {/* Users management route */}
        <Route
          path="users"
          element={
            <AuthenticatedRouteGuard>
              <SystemRoleGuard
                validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR]}
                fallback={<Navigate to="/forbidden" replace />}>
                <ManageUsersPage />
              </SystemRoleGuard>
            </AuthenticatedRouteGuard>
          }
        />
      </Route>
    </Routes>
  );
};
