import { mdiArrowRight } from '@mdi/js';
import Icon from '@mdi/react';
import Stack from '@mui/material/Stack';
import { GridRowSelectionModel } from '@mui/x-data-grid';
import ManageSecurity from 'components/security/ManageSecurity';
import CompleteSecurityReviewButton from 'features/submissions/components/PublishSecurityReview/CompleteSecurityReviewButton';
import { useApi } from 'hooks/useApi';
import { useDialogContext, useSubmissionContext } from 'hooks/useContext';
import PublishSecurityReviewButton from './PublishSecurityReview/PublishSecurityReviewButton';

export interface ISubmissionHeaderToolbarProps {
  submissionFeatureIds: GridRowSelectionModel;
}

/**
 * Submission header toolbar for admin single-submission view.
 *
 * @return {*}
 */
const SubmissionHeaderToolbar = (props: ISubmissionHeaderToolbarProps) => {
  const submissionContext = useSubmissionContext();
  const dialogContext = useDialogContext();
  const api = useApi();

  const submissionRecordDataLoader = submissionContext.submissionRecordDataLoader;

  if (!submissionRecordDataLoader.data) {
    return <></>; // <CircularProgress className="pageProgress" size={40} />; // TODO makes no sense to show a spinner inside a header
  }

  const submission = submissionRecordDataLoader.data;

  const onSecurityReviewComplete = async () => {
    await api.submissions.updateSubmissionRecord(submissionContext.submissionId, { security_reviewed: true });
    dialogContext.setSnackbar({
      open: true,
      snackbarMessage: 'Submission Security Reviewed'
    });
    submissionRecordDataLoader.refresh(submissionContext.submissionId);
  };

  const onSecurityReviewRemove = async () => {
    await api.submissions.updateSubmissionRecord(submissionContext.submissionId, {
      security_reviewed: false,
      published: false
    });
    dialogContext.setSnackbar({
      open: true,
      snackbarMessage: 'Submission Security Review Reopened'
    });
    submissionRecordDataLoader.refresh(submissionContext.submissionId);
  };

  const onSecurityReviewPublish = async () => {
    await api.submissions.updateSubmissionRecord(submissionContext.submissionId, {
      security_reviewed: true,
      published: true
    });
    dialogContext.setSnackbar({
      open: true,
      snackbarMessage: 'Submission Published'
    });
    submissionRecordDataLoader.refresh(submissionContext.submissionId);
  };

  const onSecurityReviewUnPublish = async () => {
    await api.submissions.updateSubmissionRecord(submissionContext.submissionId, {
      published: false
    });
    dialogContext.setSnackbar({
      open: true,
      snackbarMessage: 'Submission Unpublished'
    });
    submissionRecordDataLoader.refresh(submissionContext.submissionId);
  };

  return (
    <Stack flexDirection="row" alignItems="center" gap={1}>
      <ManageSecurity
        submissionFeatureIds={props.submissionFeatureIds}
        onClose={() => {
          submissionRecordDataLoader.refresh(submissionContext.submissionId);
          submissionContext.submissionFeatureGroupsDataLoader.refresh(submissionContext.submissionId);
        }}
      />

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

export default SubmissionHeaderToolbar;
