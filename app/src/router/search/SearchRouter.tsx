import SubmissionPage from 'features/datasets/DatasetPage';
import SubmissionsListPage from 'features/submissions/list/SubmissionsListPage';
import { Navigate, Route, Routes } from 'react-router-dom';
import { PageTitle } from 'utils/RouteWithMeta';

/**
 * Router for all `/search/` pages.
 */
export const SearchRouter = () => {
  return (
    <Routes>
      {/* Default redirect */}
      <Route
        path="/"
        element={
          <>
            <PageTitle title="Search" description="Browse submitted search" />
            <SubmissionsListPage />
          </>
        }
      />
      {/* Route for submission details with meta */}
      <Route
        path="/:id/details"
        element={
          <>
            <PageTitle title="Submission Details" description="Details of a specific submission" />
            <SubmissionPage />
          </>
        }
      />
      {/* Catch any unknown routes, and re-direct to the not found page */}
      <Route path="*" element={<Navigate to="/page-not-found" replace />} />
    </Routes>
  );
};
