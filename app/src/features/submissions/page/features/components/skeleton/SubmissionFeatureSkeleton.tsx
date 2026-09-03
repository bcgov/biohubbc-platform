import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import { PageHeader } from 'components/header/PageHeader';
import { SkeletonMap, SkeletonTable } from 'components/loading/SkeletonLoaders';
import { PageSection } from 'components/section/PageSection';
import { SUBMISSION_FEATURE_MAP_SECTION_HEIGHT } from 'constants/spatial';

/**
 * Loading skeleton that mirrors the submission feature detail page layout.
 *
 * Represents the feature header and Details tab followed by placeholders for
 * the Properties, Map, and About sections.
 *
 * @returns {JSX.Element} The full-page submission feature loading skeleton.
 */
export const SubmissionFeatureSkeleton = () => {
  return (
    <Box data-testid="feature-skeleton">
      <PageHeader
        maxWidth="xl"
        breadcrumbs={<Skeleton variant="text" width={220} height={24} />}
        label={<Skeleton variant="text" width={320} height={44} />}
        subheader={
          <Stack direction="row" spacing={1}>
            <Skeleton variant="rounded" width={100} height={32} />
            <Skeleton variant="rounded" width={140} height={32} />
          </Stack>
        }
        tabs={<Skeleton variant="text" width={72} height={48} />}
      />

      <Container maxWidth="xl">
        <Stack spacing={3} py={4}>
          <PageSection
            id="submission-feature-properties-skeleton"
            label={<Skeleton variant="text" width={120} height={36} />}
            headerContent={<Skeleton variant="rounded" width={250} height={40} />}>
            <SkeletonTable numberOfLines={6} />
          </PageSection>

          <PageSection id="submission-feature-map-skeleton" label={<Skeleton variant="text" width={70} height={36} />}>
            <Box sx={{ position: 'relative', display: 'flex', height: SUBMISSION_FEATURE_MAP_SECTION_HEIGHT }}>
              <SkeletonMap />
            </Box>
          </PageSection>

          <PageSection
            id="submission-feature-about-skeleton"
            label={<Skeleton variant="text" width={80} height={36} />}>
            <SkeletonTable numberOfLines={4} />
          </PageSection>
        </Stack>
      </Container>
    </Box>
  );
};
