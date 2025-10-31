import SubmissionsListPage from 'features/submissions/list/SubmissionsListPage';
import SubmissionFeaturePage from 'features/submissions/page/features/SubmissionFeaturePage';
import SubmissionPage from 'features/submissions/page/SubmissionPage';
import BaseLayout from 'layouts/BaseLayout';
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
          <BaseLayout>
            <PageTitle title="Search" description="Browse submitted search" />
            <SubmissionsListPage />
          </BaseLayout>
        }
      />

      {/* Route for submission details with meta */}
      <Route
        path="/:submissionId/details"
        element={
          <BaseLayout>
            <PageTitle title="Submission Details" description="Details of a specific submission" />
            <SubmissionPage />
          </BaseLayout>
        }
      />

      {/* Route for submission details with meta */}
      <Route
        path="/:submissionId/feature/:submissionFeatureId"
        element={
          <BaseLayout>
            <PageTitle title="Submission Details" description="Details of a specific submission" />
            <SubmissionFeaturePage />
          </BaseLayout>
        }
      />

      {/* Catch any unknown routes, and re-direct to the not found page */}
      <Route path="*" element={<Navigate to="/page-not-found" replace />} />
    </Routes>
  );
};
