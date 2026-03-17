import { SYSTEM_ROLE } from 'constants/roles';
import { ManagePoliciesPage } from 'features/admin/policies/ManagePoliciesPage';
import { ManageSecurityPage } from 'features/admin/security/ManageSecurityPage';
import ManageUsersPage from 'features/admin/users/ManageUsersPage';
import { SystemRoleGuard } from 'guards/Guards';
import { AuthenticatedRouteGuard } from 'guards/RouteGuards';
import BaseLayout from 'layouts/BaseLayout';
import { Navigate, Route, Routes } from 'react-router-dom';
import { PageTitle } from 'utils/RouteWithMeta';
import { SubmissionsRouter } from './submission/SubmissionRouter';
import { TicketsRouter } from './ticket/TicketsRouter';

/**
 * Returns routes for system administrators
 *
 * @returns
 */
export const AdminRouter = () => {
  return (
    <Routes>
      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/admin/submissions" replace />} />

      {/* Submissions route  */}
      <Route
        path="submissions/*"
        element={
          <BaseLayout>
            <PageTitle title="Review Submissions" description="Overview of the Submissions for Review" />
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

      {/* Manage Users route */}
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

      {/* Manage Policies route */}
      <Route
        path="policies"
        element={
          <BaseLayout>
            <PageTitle title="Manage Policies" description="Manage access policies" />
            <AuthenticatedRouteGuard>
              <SystemRoleGuard
                validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR]}
                fallback={<Navigate to="/forbidden" replace />}>
                <ManagePoliciesPage />
              </SystemRoleGuard>
            </AuthenticatedRouteGuard>
          </BaseLayout>
        }
      />

      {/* Security route */}
      <Route
        path="security"
        element={
          <BaseLayout>
            <PageTitle title="Security" description="View security categories and reasons" />
            <AuthenticatedRouteGuard>
              <SystemRoleGuard
                validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR]}
                fallback={<Navigate to="/forbidden" replace />}>
                <ManageSecurityPage />
              </SystemRoleGuard>
            </AuthenticatedRouteGuard>
          </BaseLayout>
        }
      />

      {/* Tickets route */}
      <Route
        path="tickets/*"
        element={
          <BaseLayout>
            <PageTitle title="Tickets" description="Manage administrative tickets" />
            <AuthenticatedRouteGuard>
              <SystemRoleGuard
                validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN]}
                fallback={<Navigate to="/forbidden" replace />}>
                <TicketsRouter />
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
