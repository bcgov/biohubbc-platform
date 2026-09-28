import { Navigate, useParams } from 'react-router-dom';
import { parseRouteId } from 'utils/routes';
import { SubmissionReviewFeaturePageContent } from './components/content/SubmissionReviewFeaturePageContent';

/**
 * Render a feature detail page scoped to an administrative submission-upload review.
 *
 * Validates route identifiers and delegates feature loading and presentation to the content component.
 *
 * @returns {JSX.Element} Administrative review feature detail page.
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
      submissionId={submissionId}
      submissionUploadId={params.submissionUploadId}
      submissionUploadReviewId={params.submissionUploadReviewId}
      submissionFeatureId={submissionFeatureId}
    />
  );
};
