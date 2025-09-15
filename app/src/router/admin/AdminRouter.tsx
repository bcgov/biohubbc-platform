import { SYSTEM_ROLE } from 'constants/roles';
import ManageUsersPage from 'features/admin/users/ManageUsersPage';
import { SystemRoleGuard } from 'guards/Guards';
import { AuthenticatedRouteGuard } from 'guards/RouteGuards';
import BaseLayout from 'layouts/BaseLayout';
import { Navigate, Route, Routes } from 'react-router-dom';
import { PageTitle } from 'utils/RouteWithMeta';
import { SubmissionsRouter } from './submission/SubmissionRouter';

/**
 * Returns routes for system administrators
 *
 * @returns
 */
export const AdminRouter = () => {
  return (
    <Routes>
      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />

      {/* Dashboard route with meta */}
      <Route
        path="dashboard"
        element={
          <BaseLayout>
            <PageTitle title="Admin Dashboard" description="Overview of the admin dashboard" />
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
      <Route
        path="users"
        element={
          <BaseLayout>
            <PageTitle title="Manage Users" description="Manage users and their roles" />
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
