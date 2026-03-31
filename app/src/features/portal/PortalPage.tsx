import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { PageHeader } from 'components/header/PageHeader';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import RecordsFoundSkeletonLoader from 'components/skeleton/submission-card/RecordsFoundSkeletonLoader';
import SubmissionCardSkeletonLoader from 'components/skeleton/submission-card/SubmissionCardSkeletonLoader';
import { PortalPageNoDataFallback } from 'features/portal/components/PortalPageNoDataFallback';
import { PortalSubmissionCard } from 'features/portal/components/PortalSubmissionCard';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { SubmissionRecordWithSecurityAndRootFeature } from 'interfaces/useSubmissionsApi.interface';
import { useEffect, useMemo } from 'react';
import { pluralize as p } from 'utils/Utils';

/**
 * Portal page displaying the list of submissions accessible to the current user.
 * Shows a skeleton loader while data is fetching, and an empty-state fallback when
 * no submissions are found.
 */
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
