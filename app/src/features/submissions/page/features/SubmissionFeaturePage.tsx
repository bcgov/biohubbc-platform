import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { ComponentSwitch } from 'components/switch/ComponentSwitch';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { parseRouteId } from 'utils/routes';
import { SubmissionFeatureDetailContent } from './components/SubmissionFeatureDetailContent';
import { SubmissionFeatureHeader, SubmissionFeatureTab } from './components/header/SubmissionFeatureHeader';
import { SubmissionFeatureSkeleton } from './components/skeleton/SubmissionFeatureSkeleton';

/**
 * Submission feature detail page.
 *
 * Loads the requested feature, handles loading and missing-data states, and
 * renders the persistent feature header with tab-specific content.
 *
 * @returns {JSX.Element} The submission feature detail page.
 */
export const SubmissionFeaturePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const biohubApi = useApi();
  const [activeTab, setActiveTab] = useState<SubmissionFeatureTab>('details');

  const params = useParams<{ submissionId: string; submissionFeatureId: string }>();
  const submissionId = parseRouteId(params.submissionId);
  const submissionFeatureId = parseRouteId(params.submissionFeatureId);

  const featureDataLoader = useDataLoader(
    (submissionId, submissionFeatureId) =>
      biohubApi.features.getSubmissionFeatureById(submissionId, submissionFeatureId),
    (error: unknown) => {
      const status = (error as APIError)?.status;
      if (status === 401 || status === 403) {
        navigate('/forbidden', { replace: true });
      }
    }
  );
  useEffect(() => {
    if (submissionId === null || submissionFeatureId === null) {
      return;
    }

    featureDataLoader.refresh(submissionId, submissionFeatureId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId, submissionFeatureId]);

  const feature = featureDataLoader.data?.feature;

  if (submissionId === null || submissionFeatureId === null) {
    return <Navigate to="/page-not-found" replace />;
  }

  return (
    <LoadingGuard
      isLoading={featureDataLoader.isLoading && !feature}
      isLoadingFallback={<SubmissionFeatureSkeleton />}
      isLoadingFallbackDelay={300}
      hasNoData={!feature}
      hasNoDataFallback={
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={300} p={2}>
          <Typography color="text.secondary">No data available</Typography>
        </Box>
      }>
      {feature && (
        <>
          <SubmissionFeatureHeader
            feature={feature}
            rootBreadcrumbLabel="Search"
            rootBreadcrumbTo={`/search/${location.search}`}
            submissionDetailBasePath="/submission"
            queryString={location.search}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
          <ComponentSwitch<SubmissionFeatureTab>
            switch={activeTab}
            components={{
              details: <SubmissionFeatureDetailContent feature={feature} featureRouteBasePath="/submission" />
            }}
          />
        </>
      )}
    </LoadingGuard>
  );
};
