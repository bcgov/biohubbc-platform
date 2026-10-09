import { Navigate, useParams } from 'react-router-dom';
import { parseRouteId } from 'utils/routes';
import { SubmissionReviewFeaturePageContent } from './components/content/SubmissionReviewFeaturePageContent';

/**
 * Resolve an existing administrative review feature URL to feature-type properties.
 *
 * Validates route identifiers and delegates feature-type resolution to the content component.
 *
 * @returns {JSX.Element} Administrative review feature-type redirect.
 */
export const SubmissionReviewFeaturePage = () => {
  const params = useParams<{
    submissionId: string;
    submissionUploadId: string;
    submissionUploadReviewId: string;
    submissionFeatureId: string;
  }>();
  const submissionId = parseRouteId(params.submissionId);
  const submissionFeatureId = parseRouteId(params.submissionFeatureId);

  if (
    submissionId === null ||
    submissionFeatureId === null ||
    !params.submissionUploadId ||
    !params.submissionUploadReviewId
  ) {
    return <Navigate to="/page-not-found" replace />;
  }

  return (
    <SubmissionReviewFeaturePageContent
      key={submissionFeatureId}
      submissionId={submissionId}
      submissionUploadId={params.submissionUploadId}
      submissionUploadReviewId={params.submissionUploadReviewId}
      submissionFeatureId={submissionFeatureId}
    />
  );
};
