import { Navigate, useParams } from 'react-router-dom';
import { parseRouteId } from 'utils/routes';
import { AdminSubmissionPageContent } from './components/AdminSubmissionPageContent';

/**
 * Administrative submission page: validates the route's submission id, then shows the submission. The content is
 * keyed by submission, so its grid starts on the first page for each one.
 *
 * @returns {JSX.Element} The submission overview, or a redirect when the id identifies no submission.
 */
export const AdminSubmissionPage = () => {
  const submissionId = parseRouteId(useParams<{ submission_id: string }>().submission_id);

  if (submissionId === null) {
    return <Navigate to="/page-not-found" replace />;
  }

  return <AdminSubmissionPageContent key={submissionId} submissionId={submissionId} />;
};
