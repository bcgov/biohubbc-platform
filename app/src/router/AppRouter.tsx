import AccessDenied from 'features/403/AccessDenied';
import NotFoundPage from 'features/404/NotFoundPage';
import DatasetsRouter from 'features/datasets/DatasetsRouter';
import BaseLayout from 'layouts/BaseLayout';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import RouteWithTitle from 'utils/RouteWithTitle';
import { getTitle } from 'utils/Utils';
import { AdminRouter } from './admin/AdminRouter';

export const AppRouter = () => {
  const location = useLocation();

  // Strip trailing slashes (optional redirect)
  if (location.pathname.match(/.+\/$/)) {
    const cleanedPath = location.pathname.replace(/\/+$/, '');
    return <Navigate to={cleanedPath} replace />;
  }

  return (
    <Routes>
      {/* Admin Routes */}
      <Route path="/admin/*" element={<AdminRouter />} />

      {/* App Routes inside BaseLayout */}
      <Route element={<BaseLayout />}>
        <Route path="/" element={<DatasetsRouter />} />

        <Route
          path="/page-not-found"
          element={
            <RouteWithTitle title={getTitle('Page Not Found')}>
              <NotFoundPage />
            </RouteWithTitle>
          }
        />

        <Route
          path="/forbidden"
          element={
            <RouteWithTitle title={getTitle('Forbidden')}>
              <AccessDenied />
            </RouteWithTitle>
          }
        />
      </Route>

      {/* Catch-all redirect to 404 */}
      <Route path="*" element={<Navigate to="/page-not-found" replace />} />
    </Routes>
  );
};
