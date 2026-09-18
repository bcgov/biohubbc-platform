import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonPage } from 'components/loading/SkeletonPage';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { SubmissionDetails } from './SubmissionDetails';
import { SubmissionDetailTab, SubmissionHeader } from './header/SubmissionHeader';

/** Keeps loaded data and feature state scoped to one submission for the lifetime of the component. */
export const SubmissionDetailPageContent = ({ submissionId }: { submissionId: number }) => {
  const location = useLocation();
  const api = useApi();
  const [activeTab, setActiveTab] = useState<SubmissionDetailTab>('details');
  const submissionDataLoader = useDataLoader((id: number) => api.submissions.getSubmissionRecordWithSecurity(id));

  useEffect(() => {
    submissionDataLoader.load(submissionId);
  }, [submissionId, submissionDataLoader]);

  const submission = submissionDataLoader.data;

  return (
    <LoadingGuard
      isLoading={submissionDataLoader.isLoading && !submission}
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
