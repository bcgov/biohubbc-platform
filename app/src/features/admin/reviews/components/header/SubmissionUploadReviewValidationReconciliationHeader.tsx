import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { PageHeader } from 'components/header/PageHeader';
import { TabGroup } from 'components/tabs/TabGroup';
import { ISubmissionUploadReviewDetail } from 'interfaces/useAdminApi.interface';
import { Link as RouterLink } from 'react-router-dom';

interface SubmissionUploadReviewValidationReconciliationHeaderProps {
  submissionId: number;
  review: ISubmissionUploadReviewDetail;
  label: string;
}

/**
 * Render outcome navigation and the single Feature types tab.
 * @param {SubmissionUploadReviewValidationReconciliationHeaderProps} props Review ancestry and outcome label.
 * @returns {JSX.Element} Outcome page header.
 */
export const SubmissionUploadReviewValidationReconciliationHeader = ({
  submissionId,
  review,
  label
}: SubmissionUploadReviewValidationReconciliationHeaderProps) => (
  <PageHeader
    maxWidth="xl"
    breadcrumbs={
      <Breadcrumbs aria-label="reconciliation breadcrumb">
        <Link component={RouterLink} to={`/admin/submissions/${submissionId}`} underline="hover" color="inherit">
          Submission
        </Link>
        <Typography variant="inherit" color="inherit">
          Review
        </Typography>
        <Link
          component={RouterLink}
          to={`/admin/submission/${submissionId}/upload/${review.submission_upload_id}/review/${review.submission_upload_review_id}`}
          underline="hover"
          color="inherit">
          {review.name}
        </Link>
        <Typography variant="inherit" color="text.primary">
          {label}
        </Typography>
      </Breadcrumbs>
    }
    label={<Typography variant="h1">{label}</Typography>}
    tabs={
      <TabGroup
        value="feature-types"
        onChange={() => {}}
        ariaLabel="Reconciliation sections"
        tabs={[{ value: 'feature-types', label: 'Feature types' }]}
      />
    }
  />
);
