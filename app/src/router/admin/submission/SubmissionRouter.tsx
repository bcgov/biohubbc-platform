import DatasetPage from 'features/datasets/DatasetPage';
import SubmissionsListPage from 'features/submissions/list/SubmissionsListPage';
import { Navigate, Route, Routes } from 'react-router-dom';
import { PageTitle } from 'utils/RouteWithMeta';

/**
 * Router for all `/submissions/` pages.
 */
export const SubmissionsRouter = () => {
  return (
    <Routes>
      {/* Default redirect */}
      <Route
        path="/"
        element={
          <>
            <PageTitle title="Submissions" description="Browse submitted submissions" />
            <SubmissionsListPage />
          </>
        }
      />
      {/* Route for submission details with meta */}
      <Route
        path="/:id/details"
        element={
          <>
            <PageTitle title="Dataset Details" description="Details of a specific submission" />
            <DatasetPage />
          </>
        }
      />
      {/* Catch any unknown routes, and re-direct to the not found page */}
      <Route path="*" element={<Navigate to="/page-not-found" replace />} />
    </Routes>
  );
};
