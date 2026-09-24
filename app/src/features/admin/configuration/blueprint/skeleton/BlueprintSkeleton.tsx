import Container from '@mui/material/Container';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { PageHeader } from 'components/header/PageHeader';
import { PageSection } from 'components/section/PageSection';
import { ConfigurationTableSkeleton } from '../../skeleton/ConfigurationTableSkeleton';

/**
 * Match the blueprint detail header and selected section while metadata loads.
 *
 * @returns Blueprint loading layout with matching toolbar and table dimensions.
 */
export const BlueprintSkeleton = () => {
  const columns = [
    { field: 'property', flex: 0.3 },
    { field: 'value', flex: 0.7 }
  ];
  return (
    <Stack data-testid="blueprint-skeleton" aria-label="Loading blueprint" aria-busy="true">
      <PageHeader
        breadcrumbs={
          <Typography>
            <Skeleton width={280} sx={{ maxWidth: '100%' }} />
          </Typography>
        }
        label={
          <Typography variant="h1" sx={{ ml: '-2px' }}>
            <Skeleton width={320} sx={{ maxWidth: '100%' }} />
          </Typography>
        }
        buttons={
          <Stack direction="row" spacing={1}>
            <Skeleton variant="rounded" width={80} height={30} />
            <Skeleton variant="rounded" width={64} height={30} />
          </Stack>
        }
        subheader={
          <Typography color="text.secondary" sx={{ mt: -1 }}>
            <Skeleton width="65%" />
          </Typography>
        }
        tabs={
          <Stack direction="row" sx={{ height: 48 }}>
            {Array.from({ length: 1 }, (_, index) => (
              <Stack key={index} justifyContent="center" sx={{ px: 2, minWidth: 90 }}>
                <Skeleton width={80} />
              </Stack>
            ))}
          </Stack>
        }
      />
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <PageSection id="blueprint-loading" label={<Skeleton width={90} />}>
          <ConfigurationTableSkeleton columns={columns} rowCount={6} hideFooter />
        </PageSection>
      </Container>
    </Stack>
  );
};
