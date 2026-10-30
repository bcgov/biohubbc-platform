import { SubmissionUploadReviewValidationFeatureTypePage } from 'features/admin/reviews/SubmissionUploadReviewValidationFeatureTypePage';
import { SubmissionUploadReviewValidationReconciliationPage } from 'features/admin/reviews/SubmissionUploadReviewValidationReconciliationPage';
import { BlueprintFeatureTypePage } from 'features/admin/configuration/blueprint/feature/BlueprintFeatureTypePage';
import { BlueprintPage } from 'features/admin/configuration/blueprint/BlueprintPage';
import { AdminConfigurationPage } from 'features/admin2/configuration/AdminConfigurationPage';
import { AdminDataRequestsPage } from 'features/admin2/data-requests/AdminDataRequestsPage';
import { AdminDataRequestPage } from 'features/admin2/data-requests/detail/AdminDataRequestPage';
import { AdminDataRequestFeatureTypePage } from 'features/admin2/data-requests/detail/feature-type/AdminDataRequestFeatureTypePage';
import { AdminFormsPage } from 'features/admin2/forms/AdminFormsPage';
import { AdminFormLayoutPage } from 'features/admin2/forms/layout/AdminFormLayoutPage';
import { AdminSecurityPage } from 'features/admin2/security/AdminSecurityPage';
import { AdminSecurityCategoryPage } from 'features/admin2/security/category/AdminSecurityCategoryPage';
import { AdminUsersPage } from 'features/admin2/users/AdminUsersPage';
import { AdminPage } from 'features/admin2/AdminPage';
import { SYSTEM_ROLE } from 'constants/roles';
import { AdminPolicyContextProvider } from 'contexts/policyContext';
import { PolicyDetailPage } from 'features/admin/policies/PolicyDetailPage';
import { SubmissionUploadReviewPage } from 'features/admin/reviews/SubmissionUploadReviewPage';
import { SubmissionReviewFeaturePage } from 'features/admin/reviews/SubmissionReviewFeaturePage';
import { ContributorDetailPage } from 'features/admin/users/contributors/ContributorDetailPage';
import { ContributorCodesetDetailPage } from 'features/admin/users/contributors/codesets/ContributorCodesetDetailPage';
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
 * @returns {JSX.Element} Authorized administrative routes.
 */
export const AdminRouter = () => {
  return (
    <Routes>
      {/* Administration landing route */}
      <Route
        path="/"
        element={
          <BaseLayout>
            <PageTitle title="Administration" description="Browse administrative sections" />
            <AuthenticatedRouteGuard>
              <SystemRoleGuard
                validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR]}
                fallback={<Navigate to="/forbidden" replace />}>
                <AdminPage />
              </SystemRoleGuard>
            </AuthenticatedRouteGuard>
          </BaseLayout>
        }
      />

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

      {/* Submission upload review routes */}
      <Route
        path="submission/:submissionId/upload/:submissionUploadId/review/:submissionUploadReviewId/:reconciliation?/feature-type/:featureType"
        element={
          <BaseLayout>
            <PageTitle
              title="Feature Type Properties"
              description="Review property definitions within a submission upload"
            />
            <AuthenticatedRouteGuard>
              <SystemRoleGuard
                validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN]}
                fallback={<Navigate to="/forbidden" replace />}>
                <SubmissionUploadReviewValidationFeatureTypePage />
              </SystemRoleGuard>
            </AuthenticatedRouteGuard>
          </BaseLayout>
        }
      />
      <Route
        path="submission/:submissionId/upload/:submissionUploadId/review/:submissionUploadReviewId/:reconciliation"
        element={
          <BaseLayout>
            <PageTitle title="Reconciliation Features" description="Review features by reconciliation outcome" />
            <AuthenticatedRouteGuard>
              <SystemRoleGuard
                validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN]}
                fallback={<Navigate to="/forbidden" replace />}>
                <SubmissionUploadReviewValidationReconciliationPage />
              </SystemRoleGuard>
            </AuthenticatedRouteGuard>
          </BaseLayout>
        }
      />
      <Route
        path="submission/:submissionId/upload/:submissionUploadId/review/:submissionUploadReviewId/feature/:submissionFeatureId"
        element={
          <BaseLayout>
            <PageTitle title="Review Feature" description="Review submission feature details" />
            <AuthenticatedRouteGuard>
              <SystemRoleGuard
                validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN]}
                fallback={<Navigate to="/forbidden" replace />}>
                <SubmissionReviewFeaturePage />
              </SystemRoleGuard>
            </AuthenticatedRouteGuard>
          </BaseLayout>
        }
      />
      <Route
        path="submission/:submissionId/upload/:submissionUploadId/review/:submissionUploadReviewId"
        element={
          <BaseLayout>
            <PageTitle title="Upload Review" description="Review submission upload features" />
            <AuthenticatedRouteGuard>
              <SystemRoleGuard
                validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN]}
                fallback={<Navigate to="/forbidden" replace />}>
                <SubmissionUploadReviewPage />
              </SystemRoleGuard>
            </AuthenticatedRouteGuard>
          </BaseLayout>
        }
      />

      <Route
        path="users/contributor/:contributorId"
        element={
          <BaseLayout>
            <PageTitle title="Contributor" description="Manage contributor and associated users" />
            <AuthenticatedRouteGuard>
              <SystemRoleGuard
                validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN]}
                fallback={<Navigate to="/forbidden" replace />}>
                <ContributorDetailPage />
              </SystemRoleGuard>
            </AuthenticatedRouteGuard>
          </BaseLayout>
        }
      />
      <Route
        path="users/contributor/:contributorId/codeset/:contributorCodesetId"
        element={
          <BaseLayout>
            <PageTitle title="Codeset" description="View a contributor codeset and its codes" />
            <AuthenticatedRouteGuard>
              <SystemRoleGuard
                validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN]}
                fallback={<Navigate to="/forbidden" replace />}>
                <ContributorCodesetDetailPage />
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
                validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN]}
                fallback={<Navigate to="/forbidden" replace />}>
                <AdminUsersPage />
              </SystemRoleGuard>
            </AuthenticatedRouteGuard>
          </BaseLayout>
        }
      />

      {/* Policies are managed on the data requests page */}
      <Route path="policies" element={<Navigate to="/admin/data-requests?tab=policies" replace />} />

      {/* Policy detail route */}
      <Route
        path="policy/:policyId"
        element={
          <BaseLayout>
            <PageTitle title="Policy" description="View policy details" />
            <AuthenticatedRouteGuard>
              <SystemRoleGuard
                validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR]}
                fallback={<Navigate to="/forbidden" replace />}>
                <AdminPolicyContextProvider>
                  <PolicyDetailPage />
                </AdminPolicyContextProvider>
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
            <PageTitle title="Manage Security" description="Manage security categories and rules" />
            <AuthenticatedRouteGuard>
              <SystemRoleGuard
                validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR]}
                fallback={<Navigate to="/forbidden" replace />}>
                <AdminSecurityPage />
              </SystemRoleGuard>
            </AuthenticatedRouteGuard>
          </BaseLayout>
        }
      />

      {/* Security category route */}
      <Route
        path="security/categories/:securityCategoryId"
        element={
          <BaseLayout>
            <PageTitle title="Security Category" description="Manage the rules of a security category" />
            <AuthenticatedRouteGuard>
              <SystemRoleGuard
                validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR]}
                fallback={<Navigate to="/forbidden" replace />}>
                <AdminSecurityCategoryPage />
              </SystemRoleGuard>
            </AuthenticatedRouteGuard>
          </BaseLayout>
        }
      />

      {/* Data requests route */}
      {/* Forms routes */}
      <Route
        path="forms"
        element={
          <BaseLayout>
            <PageTitle title="Forms" description="Manage the forms submitters fill in" />
            <AuthenticatedRouteGuard>
              <SystemRoleGuard
                validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN]}
                fallback={<Navigate to="/forbidden" replace />}>
                <AdminFormsPage />
              </SystemRoleGuard>
            </AuthenticatedRouteGuard>
          </BaseLayout>
        }
      />
      <Route
        path="forms/create"
        element={
          <BaseLayout>
            <PageTitle title="Create Form" description="Build a new form" />
            <AuthenticatedRouteGuard>
              <SystemRoleGuard
                validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN]}
                fallback={<Navigate to="/forbidden" replace />}>
                <AdminFormLayoutPage />
              </SystemRoleGuard>
            </AuthenticatedRouteGuard>
          </BaseLayout>
        }
      />
      <Route
        path="forms/:formId/versions/:formVersionId"
        element={
          <BaseLayout>
            <PageTitle title="Form" description="Build a form version" />
            <AuthenticatedRouteGuard>
              <SystemRoleGuard
                validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN]}
                fallback={<Navigate to="/forbidden" replace />}>
                <AdminFormLayoutPage />
              </SystemRoleGuard>
            </AuthenticatedRouteGuard>
          </BaseLayout>
        }
      />

      <Route
        path="data-requests"
        element={
          <BaseLayout>
            <PageTitle title="Data Requests" description="Manage the policies that represent data requests" />
            <AuthenticatedRouteGuard>
              <SystemRoleGuard
                validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR]}
                fallback={<Navigate to="/forbidden" replace />}>
                <AdminDataRequestsPage />
              </SystemRoleGuard>
            </AuthenticatedRouteGuard>
          </BaseLayout>
        }
      />

      {/* Data request detail route */}
      <Route
        path="data-requests/:dataRequestId"
        element={
          <BaseLayout>
            <PageTitle title="Data Request" description="View a data request and the policy that represents it" />
            <AuthenticatedRouteGuard>
              <SystemRoleGuard
                validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR]}
                fallback={<Navigate to="/forbidden" replace />}>
                <AdminDataRequestPage />
              </SystemRoleGuard>
            </AuthenticatedRouteGuard>
          </BaseLayout>
        }
      />

      {/* Data request feature type route */}
      <Route
        path="data-requests/:dataRequestId/feature-types/:featureType"
        element={
          <BaseLayout>
            <PageTitle title="Data Request Features" description="View the features a data request asks for" />
            <AuthenticatedRouteGuard>
              <SystemRoleGuard
                validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR]}
                fallback={<Navigate to="/forbidden" replace />}>
                <AdminDataRequestFeatureTypePage />
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

      <Route
        path="configuration"
        element={
          <BaseLayout>
            <PageTitle title="Configuration" description="Manage platform schema configuration" />
            <AuthenticatedRouteGuard>
              <SystemRoleGuard
                validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN]}
                fallback={<Navigate to="/forbidden" replace />}>
                <AdminConfigurationPage />
              </SystemRoleGuard>
            </AuthenticatedRouteGuard>
          </BaseLayout>
        }
      />

      <Route
        path="configuration/blueprints/:blueprintId"
        element={
          <BaseLayout>
            <PageTitle title="Blueprint" description="Manage platform schema configuration" />
            <AuthenticatedRouteGuard>
              <SystemRoleGuard
                validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN]}
                fallback={<Navigate to="/forbidden" replace />}>
                <BlueprintPage />
              </SystemRoleGuard>
            </AuthenticatedRouteGuard>
          </BaseLayout>
        }
      />

      <Route
        path="configuration/blueprints/:blueprintId/feature_type/:blueprintFeatureTypeId"
        element={
          <BaseLayout>
            <PageTitle title="Blueprint" description="Manage platform schema configuration" />
            <AuthenticatedRouteGuard>
              <SystemRoleGuard
                validSystemRoles={[SYSTEM_ROLE.SYSTEM_ADMIN]}
                fallback={<Navigate to="/forbidden" replace />}>
                <BlueprintFeatureTypePage />
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
