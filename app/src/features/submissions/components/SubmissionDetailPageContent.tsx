import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonPage } from 'components/loading/SkeletonPage';
import { useApi } from 'hooks/useApi';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { submissionQueryKeys } from 'utils/query-keys/submission-query-keys';
import { SubmissionDetails } from './SubmissionDetails';
import { SubmissionDetailTab, SubmissionHeader } from './header/SubmissionHeader';

/** Keeps loaded data and feature state scoped to one submission for the lifetime of the component. */
export const SubmissionDetailPageContent = ({ submissionId }: { submissionId: number }) => {
  const location = useLocation();
  const api = useApi();
  const [activeTab, setActiveTab] = useState<SubmissionDetailTab>('details');
  const submissionQuery = useQuery({
    queryKey: submissionQueryKeys.record(submissionId),
    queryFn: ({ signal }) => api.submissions.getSubmissionRecordWithSecurity(submissionId, { signal })
  });

  const submission = submissionQuery.data;

  return (
    <LoadingGuard
      isLoading={submissionQuery.isPending}
      isLoadingFallback={<SkeletonPage />}
      isLoadingFallbackDelay={300}
      hasNoData={!submission}
      hasNoDataFallback={
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={300} p={2}>
          <Typography color="text.secondary">No submission found</Typography>
        </Box>
      }>
      {submission && (
        <>
          <SubmissionHeader
            submission={submission}
            queryString={location.search}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
          <SubmissionDetails submission={submission} />
        </>
      )}
    </LoadingGuard>
  );
};
