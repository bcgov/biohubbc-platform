import { mdiArrowRight, mdiSecurity } from '@mdi/js';
import Icon from '@mdi/react';
import { Button } from '@mui/material';
import Stack from '@mui/material/Stack';
import CompleteSecurityReviewButton from 'features/submissions/components/PublishSecurityReview/CompleteSecurityReviewButton';
import { useApi } from 'hooks/useApi';
import { SubmissionRecordWithSecurity } from 'interfaces/useSubmissionsApi.interface';
import PublishSecurityReviewButton from './PublishSecurityReview/PublishSecurityReviewButton';

export interface ISubmissionHeaderToolbarProps {
  submission: SubmissionRecordWithSecurity;
  onSecurityClick: () => void;
  onSubmissionStageChange: () => void;
}

/**
 * Submission header toolbar for admin single-submission view.
 *
 * @param {ISubmissionHeaderToolbarProps} props
 * @returns {*}
 */
export const SubmissionHeaderToolbar = (props: ISubmissionHeaderToolbarProps) => {
  const { submission, onSecurityClick, onSubmissionStageChange } = props;

  const api = useApi();
  const submissionId = submission.submission_id;

  const onSecurityReviewComplete = async () => {
    await api.submissions.updateSubmissionRecord(submissionId, { security_reviewed: true });
    onSubmissionStageChange?.();
  };

  const onSecurityReviewRemove = async () => {
    await api.submissions.updateSubmissionRecord(submissionId, {
      security_reviewed: false,
      published: false
    });
    onSubmissionStageChange?.();
  };

  const onSecurityReviewPublish = async () => {
    await api.submissions.updateSubmissionRecord(submissionId, {
      security_reviewed: true,
      published: true
    });
    onSubmissionStageChange?.();
  };

  const onSecurityReviewUnPublish = async () => {
    await api.submissions.updateSubmissionRecord(submissionId, {
      published: false
    });
    onSubmissionStageChange?.();
  };

  return (
    <Stack flexDirection="row" alignItems="center" gap={1}>
      {/* Security button delegates to parent dialog */}
      <Button
        color="primary"
        variant="outlined"
        startIcon={<Icon path={mdiSecurity} size={0.75} />}
        onClick={onSecurityClick}>
        Manage Security
      </Button>

      {/* Complete Security Review buttons */}
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
