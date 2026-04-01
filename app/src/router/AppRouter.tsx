import { CartContextProvider } from 'contexts/cartContext';
import AccessDenied from 'features/403/AccessDenied';
import NotFoundPage from 'features/404/NotFoundPage';
import BaseLayout from 'layouts/BaseLayout';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { PageTitle } from 'utils/RouteWithMeta';
import { AdminRouter } from './admin/AdminRouter';
import { DataRequestRouter } from './data-request/DataRequestRouter';
import { SearchRouter } from './search/SearchRouter';
import { SubmissionRouter } from './submission/SubmissionRouter';
import { PortalRouter } from './portal/PortalRouter';
import { AuthenticatedRouteGuard } from 'guards/RouteGuards';

export const AppRouter = () => {
  return (
    <Routes>
      {/* Redirect base to search router */}
      <Route path="/" element={<Navigate to="/search" replace />} />

      {/* Search and Submission routes share CartContextProvider */}
      <Route
        element={
          <CartContextProvider>
            <Outlet />
          </CartContextProvider>
        }>
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
      </Route>

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

      {/* Data Request Routes */}
      <Route
        path="/data-request/*"
        element={
          <>
            <PageTitle title="Data Request" description="Data requests for secured data" />
            <DataRequestRouter />
          </>
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

      {/* Catch-all route to redirect to 404 */}
      <Route path="*" element={<Navigate to="/page-not-found" replace />} />
    </Routes>
  );
};
