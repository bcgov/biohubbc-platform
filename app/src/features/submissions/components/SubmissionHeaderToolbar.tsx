import { mdiArrowRight } from '@mdi/js';
import Icon from '@mdi/react';
import Stack from '@mui/material/Stack';
import { GridRowSelectionModel } from '@mui/x-data-grid';
import ManageSecurity from 'components/security/ManageSecurity';
import CompleteSecurityReviewButton from 'features/submissions/components/PublishSecurityReview/CompleteSecurityReviewButton';
import { useApi } from 'hooks/useApi';
import { SubmissionRecordWithSecurity } from 'interfaces/useSubmissionsApi.interface';
import PublishSecurityReviewButton from './PublishSecurityReview/PublishSecurityReviewButton';

export interface ISubmissionHeaderToolbarProps {
  submissionFeatureIds: Pick<GridRowSelectionModel, 'ids'>;
  submissionId: number;
  submission: SubmissionRecordWithSecurity;
  handleRefresh: () => void;
}

/**
 * Submission header toolbar for admin single-submission view.
 *
 * @returns {*}
 */
export const SubmissionHeaderToolbar = ({
  submissionFeatureIds,
  submissionId,
  submission,
  handleRefresh
}: ISubmissionHeaderToolbarProps) => {
  const api = useApi();

  const onSecurityReviewComplete = async () => {
    await api.submissions.updateSubmissionRecord(submissionId, { security_reviewed: true });
    handleRefresh?.();
  };

  const onSecurityReviewRemove = async () => {
    await api.submissions.updateSubmissionRecord(submissionId, {
      security_reviewed: false,
      published: false
    });
    handleRefresh?.();
  };

  const onSecurityReviewPublish = async () => {
    await api.submissions.updateSubmissionRecord(submissionId, {
      security_reviewed: true,
      published: true
    });
    handleRefresh?.();
  };

  const onSecurityReviewUnPublish = async () => {
    await api.submissions.updateSubmissionRecord(submissionId, {
      published: false
    });
    handleRefresh?.();
  };

  return (
    <Stack flexDirection="row" alignItems="center" gap={1}>
      <ManageSecurity submissionFeatureIds={submissionFeatureIds} onSubmit={handleRefresh} />

      <CompleteSecurityReviewButton
        submission={submission}
        onComplete={onSecurityReviewComplete}
        onRemove={onSecurityReviewRemove}
      />

      {submission.publish_timestamp == null && <Icon path={mdiArrowRight} size={0.75} />}

      <PublishSecurityReviewButton
        submission={submission}
        onComplete={onSecurityReviewPublish}
        onUnpublish={onSecurityReviewUnPublish}
      />
    </Stack>
  );
};
