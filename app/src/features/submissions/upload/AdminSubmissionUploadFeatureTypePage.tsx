import { Navigate, useParams } from 'react-router-dom';
import { parseRouteId } from 'utils/routes';
import { validate as isUuid } from 'uuid';
import { AdminSubmissionUploadFeatureTypePageContent } from './components/AdminSubmissionUploadFeatureTypePageContent';

/**
 * Validate the submission, upload and feature type route before loading administrative data.
 * @returns {JSX.Element} Feature type properties page, or a redirect for malformed identifiers.
 */
export const AdminSubmissionUploadFeatureTypePage = () => {
  const params = useParams<{ submissionId: string; submissionUploadId: string; featureType: string }>();
  const submissionId = parseRouteId(params.submissionId);
  const submissionUploadId = params.submissionUploadId;
  const featureType = params.featureType?.trim();
  if (submissionId === null || !submissionUploadId || !isUuid(submissionUploadId) || !featureType) {
    return <Navigate to="/page-not-found" replace />;
  }
  return (
    <AdminSubmissionUploadFeatureTypePageContent
      key={`${submissionId}/${submissionUploadId}/${featureType}`}
      scope={{ submissionId, submissionUploadId }}
      featureType={featureType}
    />
  );
};
