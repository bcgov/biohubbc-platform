import AccessDenied from 'features/403/AccessDenied';
import NotFoundPage from 'features/404/NotFoundPage';
import BaseLayout from 'layouts/BaseLayout';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { PageTitle } from 'utils/RouteWithMeta';
import { AdminRouter } from './admin/AdminRouter';
import DatasetsRouter from './dataset/DatasetRouter';

export const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Redirect base to datasets router */}
        <Route path="/" element={<Navigate to="/datasets" replace />} />

        {/* App Routes wrapped in BaseLayout */}
        <Route
          path="/datasets/*"
          element={
            <BaseLayout>
              <PageTitle title="Search Datasets" description="Browse and manage datasets" />
              <DatasetsRouter />
            </BaseLayout>
          }
        />

        {/* Admin Routes */}
        <Route
          path="/admin/*"
          element={
            <BaseLayout>
              <PageTitle title="Admin Panel" description="Administrative interface" />
              <AdminRouter />
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
    </BrowserRouter>
  );
};
