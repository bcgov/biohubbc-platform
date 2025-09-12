import AccessDenied from 'features/403/AccessDenied';
import NotFoundPage from 'features/404/NotFoundPage';
import DatasetsRouter from 'features/datasets/DatasetsRouter';
import BaseLayout from 'layouts/BaseLayout';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import RouteWithMeta from 'utils/RouteWithMeta';
import { AdminRouter } from './admin/AdminRouter';

export const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Admin Routes */}
        <RouteWithMeta
          path="/admin/*"
          title="Admin Panel"
          description="Administrative interface"
          element={<AdminRouter />}
        />

        {/* App Routes inside BaseLayout */}
        <Route element={<BaseLayout />}>
          <Routes>
            <RouteWithMeta
              path="/"
              title="Search Datasets"
              description="Browse and manage your datasets"
              element={<DatasetsRouter />}
            />
            <RouteWithMeta
              path="/page-not-found"
              title="Page Not Found"
              description="The page you're looking for doesn't exist"
              element={<NotFoundPage />}
            />
            <RouteWithMeta
              path="/forbidden"
              title="Access Denied"
              description="You don't have permission to access this page"
              element={<AccessDenied />}
            />
          </Routes>
        </Route>

        {/* Catch-all route to redirect to 404 */}
        <Route path="*" element={<Navigate to="/page-not-found" replace />} />
      </Routes>
    </BrowserRouter>
  );
};
