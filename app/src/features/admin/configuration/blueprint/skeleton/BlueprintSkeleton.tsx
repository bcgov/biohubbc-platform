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
 * @param props Selected section and number of header tabs.
 * @returns Blueprint loading layout with matching toolbar and table dimensions.
 */
export const BlueprintSkeleton = ({ tabCount = 2, metadata = false }: { tabCount?: number; metadata?: boolean }) => {
  const columns = metadata
    ? [
        { field: 'property', flex: 0.3 },
        { field: 'value', flex: 0.7 }
      ]
    : [
        { field: 'name', minWidth: 160, flex: 1 },
        { field: 'display_name', minWidth: 180, flex: 1 },
        { field: 'description', minWidth: 220, flex: 1 },
        ...(tabCount === 1
          ? [
              { field: 'type_name', minWidth: 140 },
              { field: 'required_value', width: 140 },
              { field: 'allow_multiple', width: 140 }
            ]
          : []),
        { field: 'actions', width: 100 }
      ];

  return (
    <Stack data-testid="blueprint-skeleton" aria-label="Loading blueprint" aria-busy="true">
      <PageHeader
        breadcrumbs={
          <Typography>
            <Skeleton width={tabCount === 1 ? 420 : 280} sx={{ maxWidth: '100%' }} />
          </Typography>
        }
        label={
          <Typography variant="h1" sx={{ ml: '-2px' }}>
            <Skeleton width={320} sx={{ maxWidth: '100%' }} />
          </Typography>
        }
        buttons={
          tabCount === 2 && (
            <Stack direction="row" spacing={1}>
              <Skeleton variant="rounded" width={80} height={30} />
              <Skeleton variant="rounded" width={64} height={30} />
            </Stack>
          )
        }
        subheader={
          <Typography color="text.secondary" sx={{ mt: -1 }}>
            <Skeleton width="65%" />
          </Typography>
        }
        tabs={
          <Stack direction="row" sx={{ height: 48 }}>
            {Array.from({ length: tabCount }, (_, index) => (
              <Stack key={index} justifyContent="center" sx={{ px: 2, minWidth: 90 }}>
                <Skeleton width={index === 0 && tabCount === 2 ? 100 : 80} />
              </Stack>
            ))}
          </Stack>
        }
      />
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <PageSection
          id="blueprint-loading"
          label={<Skeleton width={metadata ? 90 : 130} />}
          headerContent={
            !metadata && (
              <>
                <Skeleton variant="rounded" width={220} height={40} />
                <Skeleton variant="rounded" width={90} height={30} />
              </>
            )
          }>
          <ConfigurationTableSkeleton columns={columns} rowCount={metadata ? 6 : 3} hideFooter={metadata} />
        </PageSection>
      </Container>
    </Stack>
  );
};
