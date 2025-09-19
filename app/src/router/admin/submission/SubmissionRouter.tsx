import { SubmissionContextProvider } from 'contexts/submissionContext';
import DashboardPage from 'features/admin/dashboard/DashboardPage';
import AdminSubmissionPage from 'features/submissions/AdminSubmissionPage';
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

      {/* Route for submission details with meta */}
      <Route
        path="/:submission_id"
        element={
          <SubmissionContextProvider>
            <PageTitle title="Dataset Details" description="Details of a specific submission" />
            <AdminSubmissionPage />
          </SubmissionContextProvider>
        }
      />
      {/* Catch any unknown routes, and re-direct to the not found page */}
      <Route path="*" element={<Navigate to="/page-not-found" replace />} />
    </Routes>
  );
};
