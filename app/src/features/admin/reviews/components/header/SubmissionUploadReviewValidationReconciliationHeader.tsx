import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { ISubmissionUploadReviewDetail } from 'interfaces/useAdminApi.interface';
import { AdminPageLayout } from 'layouts/AdminPageLayout';
import { PropsWithChildren } from 'react';
import { Link as RouterLink } from 'react-router-dom';

/** Tabs of an outcome page: the outcome's feature types, or its features' raw submitted data. */
export type ReconciliationTab = 'feature-types' | 'features';

interface SubmissionUploadReviewValidationReconciliationHeaderProps {
  submissionId: number;
  review: ISubmissionUploadReviewDetail;
  label: string;
  activeTab: ReconciliationTab;
  onTabChange: (tab: ReconciliationTab) => void;
}

/**
 * Render an outcome page in the administrative page layout: outcome navigation and the Feature types and Features
 * tabs, above the content of the active tab passed as children.
 * @param {PropsWithChildren<SubmissionUploadReviewValidationReconciliationHeaderProps>} props Review ancestry,
 * outcome label, and active tab.
 * @returns {JSX.Element} Outcome page header and content.
 */
export const SubmissionUploadReviewValidationReconciliationHeader = ({
  submissionId,
  review,
  label,
  activeTab,
  onTabChange,
  children
}: PropsWithChildren<SubmissionUploadReviewValidationReconciliationHeaderProps>) => (
  <AdminPageLayout
    breadcrumbs={
      <Breadcrumbs aria-label="reconciliation breadcrumb">
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
    title={label}
    tabs={[
      { value: 'feature-types', label: 'Feature types' },
      { value: 'features', label: 'Features' }
    ]}
    activeTab={activeTab}
    onTabChange={onTabChange}>
    {children}
  </AdminPageLayout>
);
