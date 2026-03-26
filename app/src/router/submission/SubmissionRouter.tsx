import { SubmissionFeaturePage } from 'features/submissions/page/features/SubmissionFeaturePage';
import { SubmissionDetailPage } from 'features/submissions/SubmissionDetailPage';
import { Navigate, Route, Routes } from 'react-router-dom';
import { PageTitle } from 'utils/RouteWithMeta';

/**
 * Router for all `/submission/` pages.
 */
export const SubmissionRouter = () => {
  return (
    <Routes>
      <Route
        path="/:submissionId/feature/:submissionFeatureId"
        element={
          <>
            <PageTitle title="Submission Details" description="Details of a specific submission" />
            <SubmissionFeaturePage />
          </>
        }
      />

      <Route
        path="/:submissionId"
        element={
          <>
            <PageTitle title="Submission Details" description="Details of a specific submission" />
            <SubmissionDetailPage />
          </>
        }
      />

      {/* Catch any unknown routes, and re-direct to the not found page */}
      <Route path="*" element={<Navigate to="/page-not-found" replace />} />
    </Routes>
  );
};
