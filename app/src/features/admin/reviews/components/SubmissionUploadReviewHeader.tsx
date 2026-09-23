import Breadcrumbs from '@mui/material/Breadcrumbs';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { PageHeader } from 'components/header/PageHeader';
import { TabGroup } from 'components/tabs/TabGroup';
import { ISubmissionUploadReviewDetail } from 'interfaces/useAdminApi.interface';
import { Link as RouterLink } from 'react-router-dom';

interface SubmissionUploadReviewHeaderProps {
  submissionId: number;
  review: ISubmissionUploadReviewDetail;
  onStatusActionClick: () => void;
}

/**
 * Renders the header for a submission upload review page.
 *
 * Displays review breadcrumbs, name, description, status action, and Features tab. The
 * action is labelled Complete Review or Reopen Review from the review's status.
 *
 * @param {SubmissionUploadReviewHeaderProps} props Review metadata and status action.
 * @returns {JSX.Element} The submission upload review page header.
 */
export const SubmissionUploadReviewHeader = ({
  submissionId,
  review,
  onStatusActionClick
}: SubmissionUploadReviewHeaderProps) => {
  const isCompleted = review.status === 'completed';
  const statusActionButtonLabel = isCompleted ? 'Reopen Review' : 'Complete Review';

  return (
    <PageHeader
      maxWidth="xl"
      breadcrumbs={
        <Breadcrumbs aria-label="review breadcrumb">
          <Link component={RouterLink} to={`/admin/submissions/${submissionId}`} underline="hover" color="inherit">
            Submission
          </Link>
          <Typography color="inherit">Review</Typography>
          <Typography color="text.primary">{review.name}</Typography>
        </Breadcrumbs>
      }
      label={<Typography variant="h1">{review.name}</Typography>}
      buttons={
        <Button
          size="small"
          color={isCompleted ? 'inherit' : 'primary'}
          variant="contained"
          onClick={onStatusActionClick}
          data-testid="review-status-button">
          {statusActionButtonLabel}
        </Button>
      }
      description={review.description}
      descriptionDialogTitle="Review Description"
      tabs={
        <TabGroup
          value="features"
          onChange={() => {}}
          ariaLabel="Submission upload review sections"
          tabs={[{ value: 'features', label: 'Features' }]}
        />
      }
    />
  );
};
