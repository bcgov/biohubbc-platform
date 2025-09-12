import AccessDenied from 'features/403/AccessDenied';
import NotFoundPage from 'features/404/NotFoundPage';
import BaseLayout from 'layouts/BaseLayout';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import RouteWithMeta from 'utils/RouteWithMeta';
import { AdminRouter } from './admin/AdminRouter';
import DatasetsRouter from './dataset/DatasetRouter';

export const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Redirect base to datasets router */}
        <Route path="/" element={<Navigate to="/datasets" replace />} />

        {/* App Routes wrapped in BaseLayout */}
        <RouteWithMeta
          path="/datasets/*"
          title="Search Datasets"
          description="Browse and manage datasets"
          element={
            <BaseLayout>
              <DatasetsRouter />
            </BaseLayout>
          }
        />

        {/* Admin Routes */}
        <RouteWithMeta
          path="/admin/*"
          title="Admin Panel"
          description="Administrative interface"
          element={
            <BaseLayout>
              <AdminRouter />
            </BaseLayout>
          }
        />

        <RouteWithMeta
          path="/page-not-found"
          title="Page Not Found"
          description="The page you're looking for doesn't exist"
          element={
            <BaseLayout>
              <NotFoundPage />
            </BaseLayout>
          }
        />

        <RouteWithMeta
          path="/forbidden"
          title="Access Denied"
          description="You don't have permission to access this page"
          element={
            <BaseLayout>
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
