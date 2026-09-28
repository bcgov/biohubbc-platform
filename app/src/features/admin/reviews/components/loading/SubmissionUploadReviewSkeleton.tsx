import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import { PageHeader } from 'components/header/PageHeader';
import { SkeletonTable } from 'components/loading/SkeletonLoaders';
import { PageSection } from 'components/section/PageSection';

/**
 * Renders the upload review header and two-panel workspace while the review loads.
 * @returns {JSX.Element} Responsive feature and rule panel placeholders.
 */
export const SubmissionUploadReviewSkeleton = () => (
  <>
    <PageHeader
      breadcrumbs={<Skeleton variant="text" width={220} height={20} />}
      label={<Skeleton variant="text" width={320} height={44} />}
      subheader={
        <Stack direction="row" spacing={1}>
          <Skeleton variant="rounded" width={120} height={24} />
          <Skeleton variant="rounded" width={140} height={24} />
        </Stack>
      }
    />
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box display="grid" gridTemplateColumns={{ xs: '1fr', sm: 'minmax(0, 3fr) minmax(360px, 2fr)' }} gap={2}>
        {['features', 'rules'].map((panel) => (
          <PageSection key={panel} id={`review-${panel}-loading`} label={<Skeleton width={120} />}>
            <Stack spacing={2}>
              <Skeleton variant="rounded" height={40} />
              <SkeletonTable numberOfLines={6} />
            </Stack>
          </PageSection>
        ))}
      </Box>
    </Container>
  </>
);
