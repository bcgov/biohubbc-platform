import { mdiLock } from '@mdi/js';
import Icon from '@mdi/react';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { PageHeader } from 'components/header/PageHeader';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonPage } from 'components/loading/SkeletonPage';
import { AlertBanner } from 'components/notifications/AlertBanner';
import { PageSection } from 'components/section/PageSection';
import { ISubmissionFeature } from 'interfaces/useFeaturesApi.interface';
import { PropsWithChildren, ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { SubmissionFeatureMap } from './map/SubmissionFeatureMap';

interface SubmissionFeatureDetailContentProps {
  isLoading: boolean;
  feature?: ISubmissionFeature;
  rootBreadcrumbLabel: string;
  rootBreadcrumbTo: string;
  submissionDetailBasePath: string;
  queryString?: string;
  buttons?: ReactNode;
  breadcrumbs?: ReactNode;
}

/**
 * Shared layout for submission feature detail pages.
 *
 * Renders the common loading guard, page header, secured-feature messaging, caller-provided content, and map section.
 *
 * @param {PropsWithChildren<SubmissionFeatureDetailContentProps>} props - Component props.
 * @returns {JSX.Element} Submission feature detail layout.
 */
export const SubmissionFeatureDetailContent = ({
  isLoading,
  feature,
  rootBreadcrumbLabel,
  rootBreadcrumbTo,
  submissionDetailBasePath,
  queryString = '',
  buttons,
  breadcrumbs,
  children
}: PropsWithChildren<SubmissionFeatureDetailContentProps>) => {
  return (
    <LoadingGuard
      isLoading={isLoading}
      isLoadingFallback={<SkeletonPage />}
      isLoadingFallbackDelay={300}
      hasNoData={!feature}
      hasNoDataFallback={
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={300} p={2}>
          <Typography color="text.secondary">No data available</Typography>
        </Box>
      }>
      <PageHeader
        buttons={buttons}
        breadcrumbs={
          breadcrumbs ?? (
            <Breadcrumbs aria-label="breadcrumb">
              <Link component={RouterLink} to={rootBreadcrumbTo} underline="hover" color="inherit">
                {rootBreadcrumbLabel}
              </Link>
              <Link
                component={RouterLink}
                to={`${submissionDetailBasePath}/${feature?.submission_id}${queryString}`}
                underline="hover"
                color="inherit">
                {feature?.submission_name}
              </Link>
              <Typography color="text.primary">{feature?.feature_type_display_name}</Typography>
            </Breadcrumbs>
          )
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
        {feature?.secured && (
          <AlertBanner
            variant="standard"
            icon={<Icon path={mdiLock} size={0.75} style={{ marginTop: '1px' }} />}
            sx={{ mb: 3 }}>
            <AlertTitle sx={{ mb: 0 }}>This feature is secured</AlertTitle>
            {(feature.security_reasons ?? []).length > 0 && (
              <Typography fontSize="0.8rem">
                This feature is restricted for the following reasons: {feature.security_reasons.join(', ')}.
              </Typography>
            )}
          </AlertBanner>
        )}
        <Stack spacing={3} py={4}>
          {children}
          <PageSection id="submission-feature-map" label="Map">
            {feature && (
              <SubmissionFeatureMap
                submissionId={feature.submission_id}
                submissionFeatureId={feature.submission_feature_id}
              />
            )}
          </PageSection>
        </Stack>
      </Container>
    </LoadingGuard>
  );
};
