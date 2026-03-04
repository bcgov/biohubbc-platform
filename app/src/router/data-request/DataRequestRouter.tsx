import { RequestAccessPage } from 'features/search/request-access/RequestAccessPage';
import BaseLayout from 'layouts/BaseLayout';
import { Navigate, Route, Routes } from 'react-router-dom';
import { PageTitle } from 'utils/RouteWithMeta';

/**
 * Router for all `/data-request/` pages.
 */
export const DataRequestRouter = () => {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <BaseLayout>
            <PageTitle title="Data Request" description="Data requests for secured data" />
            <RequestAccessPage />
          </BaseLayout>
        }
      />

      {/* Catch any unknown routes, and re-direct to the not found page */}
      <Route path="*" element={<Navigate to="/page-not-found" replace />} />
    </Routes>
  );
};
