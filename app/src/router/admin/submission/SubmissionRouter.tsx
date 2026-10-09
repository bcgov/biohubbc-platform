import { AdminSubmissionUploadFeatureTypePage } from 'features/submissions/upload/AdminSubmissionUploadFeatureTypePage';
import { AdminSubmissionUploadPage } from 'features/submissions/upload/AdminSubmissionUploadPage';
import DashboardPage from 'features/admin/dashboard/DashboardPage';
import { AdminSubmissionPage } from 'features/submissions/AdminSubmissionPage';
import { CreateSubmissionPage } from 'features/submissions/create/CreateSubmissionPage';
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
            <DashboardPage />
          </>
        }
      />

      {/* Default redirect */}
      <Route
        path="/create"
        element={
          <>
            <PageTitle title="Create Submission" description="Create a new submission" />
            <CreateSubmissionPage />
          </>
        }
      />

      {/* Route for submission details with meta */}
      <Route
        path="/:submission_id"
        element={
          <>
            <PageTitle title="Submission Details" description="Details of a specific submission" />
            <AdminSubmissionPage />
          </>
        }
      />
      <Route
        path="/:submissionId/uploads/:submissionUploadId"
        element={
          <>
            <PageTitle title="Submission Upload" description="Features in a submission upload" />
            <AdminSubmissionUploadPage />
          </>
        }
      />
      <Route
        path="/:submissionId/uploads/:submissionUploadId/feature-types/:featureType"
        element={
          <>
            <PageTitle
              title="Feature Type Properties"
              description="Property definitions of a feature type within a submission upload"
            />
            <AdminSubmissionUploadFeatureTypePage />
          </>
        }
      />
      {/* Catch any unknown routes, and re-direct to the not found page */}
      <Route path="*" element={<Navigate to="/page-not-found" replace />} />
    </Routes>
  );
};
