import { Paper } from '@mui/material';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import BaseHeader from 'components/layout/header/BaseHeader';
import { useSubmissionContext } from 'hooks/useContext';
import SubmissionHeaderSecurityStatus from './components/SubmissionHeaderSecurityStatus';
import { SubmissionHeaderToolbar } from './components/SubmissionHeaderToolbar';
import { SecurityReviewFeatures } from './features/SecurityReviewFeatures';

/**
 * AdminSubmissionPage component for reviewing submissions.
 *
 * @returns {*}
 */
export const AdminSubmissionPage = () => {
  const submissionContext = useSubmissionContext();
  const submission = submissionContext.submissionRecordDataLoader.data;

  if (!submission) {
    return <></>;
  }

  return (
    <>
      <BaseHeader
        title={submission.name}
        subTitle={
          <Stack flexDirection="row" alignItems="center" gap={0.25} mt={1} mb={0.25}>
            <SubmissionHeaderSecurityStatus submission={submission} />
          </Stack>
        }
        buttonJSX={
          <SubmissionHeaderToolbar
            submissionFeatureIds={{ ids: new Set() }}
            submission={submission}
            submissionId={submissionContext.submissionId}
            handleRefresh={() => {
              // refresh both submission and features respecting current pagination/sort
              submissionContext.submissionRecordDataLoader.refresh(submissionContext.submissionId);
              submissionContext.submissionFeaturesDataLoader.refresh(
                submissionContext.featuresPagination,
                submissionContext.submissionId
              );
            }}
          />
        }
      />

      <Container maxWidth="xl">
        <Paper sx={{ my: 3 }}>
          <SecurityReviewFeatures />
        </Paper>
      </Container>
    </>
  );
};
