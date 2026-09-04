import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonPage } from 'components/loading/SkeletonPage';
import { ComponentSwitch } from 'components/switch/ComponentSwitch';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { useEffect, useState } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { parseRouteId } from 'utils/routes';
import { SubmissionDetails } from './components/SubmissionDetails';
import { SubmissionDetailTab, SubmissionHeader } from './components/header/SubmissionHeader';

/**
 * Renders the public submission detail page.
 *
 * Loads the requested submission, handles invalid and missing records, and coordinates the
 * persistent submission header with its active tab content.
 *
 * @returns {JSX.Element} The submission detail page or its loading, missing, or invalid state.
 */
export const SubmissionDetailPage = () => {
  const location = useLocation();
  const { submissionId: submissionIdParam } = useParams<{ submissionId: string }>();
  const submissionId = parseRouteId(submissionIdParam);
  const api = useApi();
  const [activeTab, setActiveTab] = useState<SubmissionDetailTab>('details');
  const submissionDataLoader = useDataLoader((id: number) => api.submissions.getSubmissionRecordWithSecurity(id));

  useEffect(() => {
    if (submissionId === null) {
      return;
    }

    submissionDataLoader.load(submissionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId]);

  if (submissionId === null) {
    return <Navigate to="/page-not-found" replace />;
  }

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
          <ComponentSwitch<SubmissionDetailTab>
            switch={activeTab}
            components={{ details: <SubmissionDetails submission={submission} /> }}
          />
        </>
      )}
    </LoadingGuard>
  );
};
