import { SYSTEM_ROLE } from 'constants/roles';
import ManageUsersPage from 'features/admin/users/ManageUsersPage';
import { SystemRoleGuard } from 'guards/Guards';
import { AuthenticatedRouteGuard } from 'guards/RouteGuards';
import BaseLayout from 'layouts/BaseLayout';
import { Navigate, Route, Routes } from 'react-router-dom';
import RouteWithMeta from 'utils/RouteWithMeta'; // Import RouteWithMeta
import { SubmissionsRouter } from './submission/SubmissionRouter';

export const AdminRouter = () => {
  return (
    <Routes>
      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />

      {/* Dashboard route with meta */}
      <RouteWithMeta
        path="dashboard"
        title="Admin Dashboard"
        description="Overview of the admin dashboard"
        element={
          <BaseLayout>
            <AuthenticatedRouteGuard>
              <SystemRoleGuard
                validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR]}
                fallback={<Navigate to="/forbidden" replace />}>
                <SubmissionsRouter />
              </SystemRoleGuard>
            </AuthenticatedRouteGuard>
          </BaseLayout>
        }
      />

      {/* Manage Users route with meta */}
      <RouteWithMeta
        path="users"
        title="Manage Users"
        description="Manage users and their roles"
        element={
          <BaseLayout>
            <AuthenticatedRouteGuard>
              <SystemRoleGuard
                validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR]}
                fallback={<Navigate to="/forbidden" replace />}>
                <ManageUsersPage />
              </SystemRoleGuard>
            </AuthenticatedRouteGuard>
          </BaseLayout>
        }
      />

      {/* Catch-all redirect for undefined routes */}
      <Route path="*" element={<Navigate to="/page-not-found" replace />} />
    </Routes>
  );
};
