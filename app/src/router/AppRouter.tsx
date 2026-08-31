import AccessDenied from 'features/403/AccessDenied';
import NotFoundPage from 'features/404/NotFoundPage';
import { DownloadPage } from 'features/download/DownloadPage';
import { SearchPage } from 'features/search/SearchPage';
import { AuthenticatedRouteGuard } from 'guards/RouteGuards';
import BaseLayout from 'layouts/BaseLayout';
import { Navigate, Route, Routes } from 'react-router';
import { PageTitle } from 'utils/RouteWithMeta';
import { AdminRouter } from './admin/AdminRouter';
import { PortalRouter } from './portal/PortalRouter';
import { SearchRouter } from './search/SearchRouter';
import { SubmissionRouter } from './submission/SubmissionRouter';

export const AppRouter = () => {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <BaseLayout>
            <PageTitle title="Search Data" description="Search and download data" />
            <SearchPage />
          </BaseLayout>
        }
      />

      {/* Search Routes */}
      <Route
        path="/search/*"
        element={
          <>
            <PageTitle title="Search Data" description="Search and download data" />
            <SearchRouter />
          </>
        }
      />

      {/* Submission Routes */}
      <Route
        path="/submission/*"
        element={
          <BaseLayout>
            <PageTitle title="Submission Details" description="Details of a specific submission" />
            <SubmissionRouter />
          </BaseLayout>
        }
      />

      {/* Admin Routes */}
      <Route
        path="/admin/*"
        element={
          <>
            <PageTitle title="Admin Panel" description="Administrative interface" />
            <AdminRouter />
          </>
        }
      />

      {/* Portal Routes */}
      <Route
        path="/portal/*"
        element={
          <BaseLayout>
            <PageTitle title="My Portal" description="View your tickets and submissions" />
            <AuthenticatedRouteGuard>
              <PortalRouter />
            </AuthenticatedRouteGuard>
          </BaseLayout>
        }
      />

      {/* Portal Routes */}
      <Route
        path="/portal/*"
        element={
          <BaseLayout>
            <PageTitle title="My Submissions" description="View your past submissions" />
            <AuthenticatedRouteGuard>
              <PortalRouter />
            </AuthenticatedRouteGuard>
          </BaseLayout>
        }
      />

      <Route
        path="/page-not-found"
        element={
          <BaseLayout>
            <PageTitle title="Page Not Found" description="The page you're looking for doesn't exist" />
            <NotFoundPage />
          </BaseLayout>
        }
      />

      <Route
        path="/forbidden"
        element={
          <BaseLayout>
            <PageTitle title="Access Denied" description="You don't have permission to access this page" />
            <AccessDenied />
          </BaseLayout>
        }
      />

      {/* Download page — the UUID is the credential for anonymous downloads. */}
      <Route
        path="/download/:downloadId"
        element={
          <BaseLayout>
            <PageTitle title="Download" description="Download status and details" />
            <DownloadPage />
          </BaseLayout>
        }
      />

      {/* Catch-all route to redirect to 404 */}
      <Route path="*" element={<Navigate to="/page-not-found" replace />} />
    </Routes>
  );
};
