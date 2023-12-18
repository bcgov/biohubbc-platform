
import CircularProgress from '@mui/material/CircularProgress';

import Stack from '@mui/material/Stack';

import BaseHeader from 'components/layout/header/BaseHeader';
import ManageSecurity from 'components/security/ManageSecurity';
import PublishSecurityReviewButton from 'features/submissions/components/PublishSecurityReview/PublishSecurityReviewButton';
import SubmissionHeaderSecurityStatus from 'features/submissions/components/SubmissionHeaderSecurityStatus';
import { useApi } from 'hooks/useApi';
import { useSubmissionContext } from 'hooks/useContext';


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
  const api = useApi();

  const submissionDataLoader = submissionContext.submissionDataLoader;

  if (!submissionDataLoader.data) {
    return <CircularProgress className="pageProgress" size={40} />;
  }

  const submission = submissionDataLoader.data?.submission;

  const onSecurityReviewComplete = async () => {
    await api.submissions.updateSubmissionRecord(submissionContext.submissionId, { security_reviewed: true });
    submissionContext.submissionDataLoader.refresh(submissionContext.submissionId);
  };

  const onSecurityReviewRemove = async () => {
    await api.submissions.updateSubmissionRecord(submissionContext.submissionId, { security_reviewed: false });
    submissionContext.submissionDataLoader.refresh(submissionContext.submissionId);
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
          <ManageSecurity features={props.selectedFeatures} />

          <PublishSecurityReviewButton
            submission={submission}
            onComplete={onSecurityReviewComplete}
            onRemove={onSecurityReviewRemove}
          />
        </Stack>
      }
    />
  );
};

export default SubmissionHeader;
