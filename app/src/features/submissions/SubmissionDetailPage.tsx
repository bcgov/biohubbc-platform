import { Navigate, useParams } from 'react-router-dom';
import { parseRouteId } from 'utils/routes';
import { SubmissionDetailPageContent } from './components/SubmissionDetailPageContent';

/**
 * Renders the public submission detail page.
 *
 * Loads the requested submission, handles invalid and missing records, and coordinates the
 * persistent submission header with its active tab content.
 *
 * @returns {JSX.Element} The submission detail page or its loading, missing, or invalid state.
 */
export const SubmissionDetailPage = () => {
  const { submissionId: submissionIdParam } = useParams<{ submissionId: string }>();
  const submissionId = parseRouteId(submissionIdParam);
  if (submissionId === null) {
    return <Navigate to="/page-not-found" replace />;
  }

  return <SubmissionDetailPageContent key={submissionId} submissionId={submissionId} />;
};
