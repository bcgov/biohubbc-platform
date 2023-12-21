import { mdiArrowRight } from '@mdi/js';
import Icon from '@mdi/react';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import BaseHeader from 'components/layout/header/BaseHeader';
import ManageSecurity from 'components/security/ManageSecurity';
import CompleteSecurityReviewButton from 'features/submissions/components/PublishSecurityReview/CompleteSecurityReviewButton';
import SubmissionHeaderSecurityStatus from 'features/submissions/components/SubmissionHeaderSecurityStatus';
import { useApi } from 'hooks/useApi';
import { useDialogContext, useSubmissionContext } from 'hooks/useContext';
import PublishSecurityReviewButton from './PublishSecurityReview/PublishSecurityReviewButton';
export interface ISubmissionHeaderProps {
  selectedFeatures: number[];
}

/**
 * Submission header for admin single-submission view.
 *
 * @return {*}
 */
const SubmissionHeader = (props: ISubmissionHeaderProps) => {
  const submissionContext = useSubmissionContext();
  const dialogContext = useDialogContext();
  const api = useApi();

  const submissionRecordDataLoader = submissionContext.submissionRecordDataLoader;

  if (!submissionRecordDataLoader.data) {
    return <CircularProgress className="pageProgress" size={40} />;
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

  const onSecurityReviewPublish = async () => {
    // await api.submissions.updateSubmissionRecord(submissionContext.submissionId, {
    //   security_reviewed: true,
    //   publish: true
    // });
    dialogContext.setSnackbar({
      open: true,
      snackbarMessage: 'Submission Published'
    });
    submissionRecordDataLoader.refresh(submissionContext.submissionId);
  };

  const onSecurityReviewRemove = async () => {
    await api.submissions.updateSubmissionRecord(submissionContext.submissionId, { security_reviewed: false });
    dialogContext.setSnackbar({
      open: true,
      snackbarMessage: 'Submission Unpublished'
    });
    submissionRecordDataLoader.refresh(submissionContext.submissionId);
  };

  return (
    <BaseHeader
      title={submission.name}
      subTitle={
        <Stack flexDirection="row" alignItems="center" gap={0.25} mt={1} mb={0.25}>
          <SubmissionHeaderSecurityStatus submission={submission} />
        </Stack>
      }
      buttonJSX={
        <Stack flexDirection="row" alignItems="center" gap={1}>
          <ManageSecurity
            features={props.selectedFeatures}
            onClose={() => submissionRecordDataLoader.refresh(submissionContext.submissionId)}
          />

          <CompleteSecurityReviewButton
            submission={submission}
            onComplete={onSecurityReviewComplete}
            onRemove={onSecurityReviewRemove}
          />
          <Icon path={mdiArrowRight} size={0.75} />
          <PublishSecurityReviewButton submission={submission} onComplete={onSecurityReviewPublish} />
        </Stack>
      }
    />
  );
};

export default SubmissionHeader;
