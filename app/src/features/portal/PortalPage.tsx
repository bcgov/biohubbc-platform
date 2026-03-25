import { mdiTextBoxOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { PageHeader } from 'components/header/PageHeader';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import RecordsFoundSkeletonLoader from 'components/skeleton/submission-card/RecordsFoundSkeletonLoader';
import SubmissionCardSkeletonLoader from 'components/skeleton/submission-card/SubmissionCardSkeletonLoader';
import { PortalSubmissionCard } from 'features/portal/components/PortalSubmissionCard';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { SubmissionRecordWithSecurityAndRootFeature } from 'interfaces/useSubmissionsApi.interface';
import { useEffect, useMemo } from 'react';
import { pluralize as p } from 'utils/Utils';

/** Empty state when the user has no submissions. */
const PortalPageNoDataFallback = () => (
  <>
    <Box pb={4}>
      <Typography variant="h4" component="h2">
        No records found
      </Typography>
    </Box>
    <Stack alignItems="center" justifyContent="center" p={3} component={Paper} elevation={0} minHeight={168}>
      <Box
        sx={{
          '& svg': {
            color: 'text.secondary'
          }
        }}>
        <Icon path={mdiTextBoxOutline} size={2} />
      </Box>
      <Typography component="h2" variant="h4" fontWeight={700} sx={{ mb: 1 }}>
        No submissions found
      </Typography>
      <Typography variant="body2" color="textSecondary">
        You have not submitted any data to BioHub yet.
      </Typography>
    </Stack>
  </>
);

const PortalPage = () => {
  const biohubApi = useApi();

  const submissionsDataLoader = useDataLoader(() => biohubApi.submissions.getSubmissionsForUser());

  useEffect(() => {
    submissionsDataLoader.load();
  }, [submissionsDataLoader]);

  const submissionRecords: SubmissionRecordWithSecurityAndRootFeature[] = useMemo(
    () => submissionsDataLoader.data || [],
    [submissionsDataLoader]
  );
  const isLoading = submissionsDataLoader.isLoading;

  return (
    <Box>
      <PageHeader label="My Submissions" />
      <Container maxWidth="xl" sx={{ py: 4, px: 3 }}>
        <LoadingGuard
          isLoading={isLoading}
          isLoadingFallback={
            <>
              <RecordsFoundSkeletonLoader />
              <SubmissionCardSkeletonLoader />
            </>
          }
          hasNoData={submissionRecords.length === 0}
          hasNoDataFallback={<PortalPageNoDataFallback />}>
          <Stack mb={4} alignItems="center" flexDirection="row" justifyContent="space-between">
            <Typography variant="h4" component="h2">
              {`${submissionRecords.length} ${p(submissionRecords.length, 'record')} found`}
            </Typography>
          </Stack>
          <Stack gap={2}>
            {submissionRecords.map((submissionRecord) => (
              <PortalSubmissionCard key={submissionRecord.submission_id} submission={submissionRecord} />
            ))}
          </Stack>
        </LoadingGuard>
      </Container>
    </Box>
  );
};

export default PortalPage;
