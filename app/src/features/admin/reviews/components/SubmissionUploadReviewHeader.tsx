import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { PrimaryButton } from 'components/button/PrimaryButton';
import { ITabGroupItem } from 'components/tabs/TabGroup';
import { ISubmissionUploadReviewDetail } from 'interfaces/useAdminApi.interface';
import { AdminPageLayout } from 'layouts/AdminPageLayout';
import { PropsWithChildren } from 'react';
import { Link as RouterLink } from 'react-router-dom';

interface SubmissionUploadReviewHeaderProps {
  submissionId: number;
  review: ISubmissionUploadReviewDetail;
  tabs: ITabGroupItem[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  onStatusActionClick: () => void;
}

/**
 * Renders a submission upload review page in the administrative page layout.
 *
 * Displays review breadcrumbs, name, description, status action, and the review's tabs, above the selected tab's
 * content passed as children. The action is labelled Complete Review or Reopen Review from the review's status.
 *
 * @param {PropsWithChildren<SubmissionUploadReviewHeaderProps>} props Review metadata, tabs and status action.
 * @returns {JSX.Element} The submission upload review page header and content.
 */
export const SubmissionUploadReviewHeader = ({
  submissionId,
  review,
  tabs,
  activeTab,
  onTabChange,
  onStatusActionClick,
  children
}: PropsWithChildren<SubmissionUploadReviewHeaderProps>) => {
  const isCompleted = review.status === 'completed';
  const statusActionButtonLabel = isCompleted ? 'Reopen Review' : 'Complete Review';

  return (
    <AdminPageLayout
      breadcrumbs={
        <Breadcrumbs aria-label="review breadcrumb">
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
          <Typography variant="inherit" color="text.primary">
            {review.name}
          </Typography>
        </Breadcrumbs>
      }
      title={review.name}
      buttons={
        <PrimaryButton
          size="small"
          color={isCompleted ? 'inherit' : 'primary'}
          onClick={onStatusActionClick}
          data-testid="review-status-button">
          {statusActionButtonLabel}
        </PrimaryButton>
      }
      description={review.description}
      descriptionDialogTitle="Review Description"
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={onTabChange}>
      {children}
    </AdminPageLayout>
  );
};
