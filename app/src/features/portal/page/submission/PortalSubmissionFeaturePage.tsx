import { mdiLock } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { SubmissionFeatureAbout } from 'components/feature/SubmissionFeatureAbout';
import { PageHeader } from 'components/header/PageHeader';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonPage } from 'components/loading/SkeletonPage';
import { FeaturePropertiesSection } from 'components/property/FeaturePropertiesSection';
import { PageSection } from 'components/section/PageSection';
import { SubmissionFeatureMap } from 'features/submissions/page/features/components/map/SubmissionFeatureMap';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { useEffect, useMemo } from 'react';
import { Link as RouterLink, Navigate, useNavigate, useParams } from 'react-router-dom';
import { parseRouteId } from 'utils/routes';

/**
 * Portal submission feature detail page scoped to the current user's submission.
 *
 * @returns {JSX.Element}
 */
export const PortalSubmissionFeaturePage = () => {
  const navigate = useNavigate();
  const api = useApi();
  const params = useParams<{ submissionId: string; submissionFeatureId: string }>();
  const submissionId = parseRouteId(params.submissionId);
  const submissionFeatureId = parseRouteId(params.submissionFeatureId);

  const featureDataLoader = useDataLoader(
    (id, featureId) => api.features.getSubmissionFeatureById(id, featureId),
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

  const { feature } = useMemo(() => featureDataLoader.data ?? { feature: undefined }, [featureDataLoader.data]);

  if (submissionId === null || submissionFeatureId === null) {
    return <Navigate to="/page-not-found" replace />;
  }

  return (
    <LoadingGuard
      isLoading={featureDataLoader.isLoading}
      isLoadingFallback={<SkeletonPage />}
      isLoadingFallbackDelay={300}
      hasNoData={!feature}
      hasNoDataFallback={
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={300} p={2}>
          <Typography color="text.secondary">No data available</Typography>
        </Box>
      }>
      <PageHeader
        breadcrumbs={
          <Breadcrumbs aria-label="breadcrumb">
            <Link component={RouterLink} to="/portal/submission" underline="hover" color="inherit">
              Portal
            </Link>
            <Link
              component={RouterLink}
              to={`/portal/submission/${feature?.submission_id}`}
              underline="hover"
              color="inherit">
              {feature?.submission_name}
            </Link>
            <Typography color="text.primary">{feature?.feature_type_display_name}</Typography>
          </Breadcrumbs>
        }
        label={
          <Box display="flex" alignItems="center" gap={1.5}>
            <Typography variant="h1" sx={{ ml: '-2px' }}>
              {feature?.feature_type_display_name}
            </Typography>
          </Box>
        }
        subheader={
          <Box display="flex" gap={1}>
            <Chip label={feature?.feature_type_name} size="small" />
            {feature?.secured && <Chip icon={<Icon path={mdiLock} size={0.625} />} label="Secured" size="small" />}
          </Box>
        }
      />
      <Container maxWidth="xl">
        <Stack spacing={3} py={4}>
          <FeaturePropertiesSection
            submissionId={submissionId}
            submissionFeatureId={submissionFeatureId}
            featureRouteBasePath="/portal/submission"
          />
          <PageSection id="portal-submission-feature-map" label="Map">
            {feature && (
              <SubmissionFeatureMap
                submissionId={feature.submission_id}
                submissionFeatureId={feature.submission_feature_id}
              />
            )}
          </PageSection>
          {feature && <SubmissionFeatureAbout feature={feature} />}
        </Stack>
      </Container>
    </LoadingGuard>
  );
};
