import { RECONCILIATION_OUTCOMES } from 'constants/reconciliation';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { ISubmissionUploadReviewDetail } from 'interfaces/useAdminApi.interface';
import { AdminPageLayout } from 'layouts/AdminPageLayout';
import { PropsWithChildren } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { getFeatureTypeDisplayLabel } from 'utils/feature-type';

interface SubmissionUploadReviewValidationFeatureTypeHeaderProps {
  submissionId: number;
  review: ISubmissionUploadReviewDetail;
  featureType: string;
  outcomeRoute?: string;
}

/**
 * Render a feature-type review page in the administrative page layout: review ancestry and the single Properties
 * tab, above the content passed as children.
 * @param {PropsWithChildren<SubmissionUploadReviewValidationFeatureTypeHeaderProps>} props Feature type and
 * originating outcome.
 * @returns {JSX.Element} Header with a breadcrumb back to the selected outcome page, and the page content.
 */
export const SubmissionUploadReviewValidationFeatureTypeHeader = ({
  submissionId,
  review,
  featureType,
  outcomeRoute,
  children
}: PropsWithChildren<SubmissionUploadReviewValidationFeatureTypeHeaderProps>) => {
  const location = useLocation();
  const outcome = RECONCILIATION_OUTCOMES.find(({ route }) => route === outcomeRoute);
  const title = getFeatureTypeDisplayLabel(featureType);
  const reviewPath = `/admin/submission/${submissionId}/upload/${review.submission_upload_id}/review/${review.submission_upload_review_id}`;
  return (
    <AdminPageLayout
      title={title}
      breadcrumbs={
        <Breadcrumbs aria-label="feature type properties breadcrumb">
          <Link component={RouterLink} to="/admin" underline="hover" color="inherit">
            Administration
          </Link>
          <Link component={RouterLink} to="/admin/submissions" underline="hover" color="inherit">
            Submissions
          </Link>
          <Link component={RouterLink} to={`/admin/submissions/${submissionId}`} underline="hover" color="inherit">
            Submission
          </Link>
          <Typography variant="inherit" color="inherit">
            Review
          </Typography>
          <Link component={RouterLink} to={reviewPath} underline="hover" color="inherit">
            {review.name}
          </Link>
          {outcome && (
            <Link
              component={RouterLink}
              to={`${reviewPath}/${outcome.route}${location.search}`}
              underline="hover"
              color="inherit">
              {outcome.label}
            </Link>
          )}
          <Typography variant="inherit" color="text.primary">
            {title}
          </Typography>
        </Breadcrumbs>
      }
      tabs={[{ value: 'properties', label: 'Properties' }]}
      activeTab="properties"
      onTabChange={() => {}}>
      {children}
    </AdminPageLayout>
  );
};
