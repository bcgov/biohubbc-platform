import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';

/**
 * Loading skeleton that mirrors the policy detail page layout.
 *
 * @returns {JSX.Element}
 */
export const PolicySkeleton = () => {
  return (
    <Box data-testid="policy-skeleton">
      <Paper square elevation={0} sx={{ boxShadow: '0 1px 2px rgba(0, 0, 0, 0.15)', borderColor: 'divider' }}>
        <Container maxWidth="xl" sx={{ py: 4, pb: 0 }}>
          <Stack spacing={1.5}>
            <Skeleton variant="text" width={220} height={24} />
            <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}>
              <Skeleton variant="text" width={360} height={44} />
              <Stack direction="row" spacing={1}>
                <Skeleton variant="rounded" width={128} height={34} />
                <Skeleton variant="rounded" width={64} height={34} />
              </Stack>
            </Stack>
            <Skeleton variant="text" width="65%" height={24} />
            <Stack direction="row" spacing={3} sx={{ pt: 1 }}>
              <Skeleton variant="text" width={90} height={48} />
              <Skeleton variant="text" width={74} height={48} />
            </Stack>
          </Stack>
        </Container>
      </Paper>

      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Paper elevation={1}>
          <Stack spacing={0}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, py: 1.5 }}>
              <Skeleton variant="text" width={140} height={36} />
              <Skeleton variant="rounded" width={160} height={34} />
            </Stack>

            <Box sx={{ borderTop: '1px solid', borderColor: 'divider', px: 2, py: 2 }}>
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={2}>
                  <Skeleton variant="text" width={120} height={24} />
                  <Skeleton variant="text" width="45%" height={24} />
                  <Skeleton variant="text" width={100} height={24} />
                  <Skeleton variant="text" width={100} height={24} />
                </Stack>
                {[0, 1, 2].map((row) => (
                  <Stack key={row} direction="row" spacing={2} alignItems="center">
                    <Skeleton variant="rounded" width={72} height={24} />
                    <Skeleton variant="text" width="45%" height={32} />
                    <Skeleton variant="text" width={88} height={32} />
                    <Skeleton variant="text" width={88} height={32} />
                  </Stack>
                ))}
              </Stack>
            </Box>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
};
