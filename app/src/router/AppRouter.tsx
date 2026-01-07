import AccessDenied from 'features/403/AccessDenied';
import NotFoundPage from 'features/404/NotFoundPage';
import BaseLayout from 'layouts/BaseLayout';
import { Navigate, Route, Routes } from 'react-router-dom';
import { PageTitle } from 'utils/RouteWithMeta';
import { AdminRouter } from './admin/AdminRouter';
import { SearchRouter } from './search/SearchRouter';

export const AppRouter = () => {
  return (
    <Routes>
      {/* Redirect base to search router */}
      <Route path="/" element={<Navigate to="/search" replace />} />

      {/* Search Routes  */}
      <Route
        path="/search/*"
        element={
          <>
            <PageTitle title="Search Data" description="Search and download data" />
            <SearchRouter />
          </>
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
