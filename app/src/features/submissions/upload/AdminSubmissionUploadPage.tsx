import { Navigate, useParams } from 'react-router-dom';
import { parseRouteId } from 'utils/routes';
import { validate as isUuid } from 'uuid';
import { AdminSubmissionUploadPageContent } from './components/AdminSubmissionUploadPageContent';

/**
 * Validate the submission and upload route before loading administrative data.
 * @returns {JSX.Element} Upload page, or a redirect for malformed identifiers.
 */
export const AdminSubmissionUploadPage = () => {
  const params = useParams<{ submissionId: string; submissionUploadId: string }>();
  const submissionId = parseRouteId(params.submissionId);
  const submissionUploadId = params.submissionUploadId;
  if (submissionId === null || !submissionUploadId || !isUuid(submissionUploadId)) {
    return <Navigate to="/page-not-found" replace />;
  }
  return (
    <AdminSubmissionUploadPageContent
      key={`${submissionId}/${submissionUploadId}`}
      scope={{ submissionId, submissionUploadId }}
    />
  );
};
