import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import { PageHeader } from 'components/header/PageHeader';
import { SkeletonTable } from 'components/loading/SkeletonLoaders';
import { PageSection } from 'components/section/PageSection';

/**
 * Loading skeleton that mirrors the policy detail page layout.
 *
 * @returns {JSX.Element}
 */
export const PolicySkeleton = () => {
  return (
    <Box data-testid="policy-skeleton">
      <PageHeader
        maxWidth="xl"
        breadcrumbs={<Skeleton variant="text" width={220} height={24} />}
        label={<Skeleton variant="text" width={360} height={44} />}
        subheader={<Skeleton variant="text" width="65%" height={24} />}
        buttons={
          <Stack direction="row" spacing={1}>
            <Skeleton variant="rounded" width={128} height={34} />
            <Skeleton variant="rounded" width={64} height={34} />
          </Stack>
        }
        tabs={
          <Stack direction="row" spacing={3}>
            <Skeleton variant="text" width={90} height={48} />
            <Skeleton variant="text" width={74} height={48} />
          </Stack>
        }
      />

      <Container maxWidth="xl" sx={{ py: 4 }}>
        <PageSection
          id="policy-skeleton-section"
          label={<Skeleton variant="text" width={140} height={36} />}
          headerContent={<Skeleton variant="rounded" width={160} height={34} />}>
          <SkeletonTable />
        </PageSection>
      </Container>
    </Box>
  );
};
