import { RECONCILIATION_OUTCOMES } from 'constants/reconciliation';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { PageHeader } from 'components/header/PageHeader';
import { TabGroup } from 'components/tabs/TabGroup';
import { ISubmissionUploadReviewDetail } from 'interfaces/useAdminApi.interface';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { getFeatureTypeDisplayLabel } from 'utils/feature-type';

interface SubmissionUploadReviewValidationFeatureTypeHeaderProps {
  submissionId: number;
  review: ISubmissionUploadReviewDetail;
  featureType: string;
  outcomeRoute?: string;
}

/**
 * Render feature-type review ancestry and the single Properties tab.
 * @param {SubmissionUploadReviewValidationFeatureTypeHeaderProps} props Feature type and originating outcome.
 * @returns {JSX.Element} Header with a breadcrumb back to the selected outcome page.
 */
export const SubmissionUploadReviewValidationFeatureTypeHeader = ({
  submissionId,
  review,
  featureType,
  outcomeRoute
}: SubmissionUploadReviewValidationFeatureTypeHeaderProps) => {
  const location = useLocation();
  const outcome = RECONCILIATION_OUTCOMES.find(({ route }) => route === outcomeRoute);
  const title = getFeatureTypeDisplayLabel(featureType);
  const reviewPath = `/admin/submission/${submissionId}/upload/${review.submission_upload_id}/review/${review.submission_upload_review_id}`;
  return (
    <PageHeader
      maxWidth="xl"
      label={<Typography variant="h1">{title}</Typography>}
      breadcrumbs={
        <Breadcrumbs aria-label="feature type properties breadcrumb">
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
      tabs={
        <TabGroup
          value="properties"
          onChange={() => {}}
          ariaLabel="Feature type review sections"
          tabs={[{ value: 'properties', label: 'Properties' }]}
        />
      }
    />
  );
};
