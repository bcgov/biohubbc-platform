import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';

/**
 * Loading skeleton that mirrors the ticket detail page layout.
 *
 * @return {*}
 */
export const TicketSkeleton = () => {
  return (
    <>
      <Paper square elevation={0} sx={{ boxShadow: '0 1px 2px rgba(0, 0, 0, 0.15)', borderColor: 'divider' }}>
        <Container maxWidth="xl" sx={{ py: 4 }}>
          <Stack spacing={1.5}>
            <Skeleton variant="text" width={220} height={24} />
            <Skeleton variant="text" width={320} height={44} />
            <Stack direction="row" spacing={1}>
              <Skeleton variant="rounded" width={110} height={24} />
              <Skeleton variant="rounded" width={90} height={24} />
            </Stack>
            <Skeleton variant="text" width="65%" height={24} />
          </Stack>
        </Container>
      </Paper>

      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Paper elevation={1} sx={{ p: { xs: 2, md: 3 } }}>
          <Stack
            sx={{
              display: 'flex',
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 7,
              alignItems: 'flex-start'
            }}>
            <Stack spacing={4} sx={{ flex: '1 1 0', minWidth: { xs: '100%', md: 560 } }}>
              <Skeleton variant="rounded" height={72} />
              <Skeleton variant="rounded" height={156} />
              <Stack direction="row" justifyContent="flex-end">
                <Skeleton variant="rounded" width={120} height={32} />
              </Stack>
            </Stack>

            <Box sx={{ width: { xs: '100%', sm: 280 }, flex: { xs: '1 1 100%', sm: '0 0 280px' } }}>
              <Stack spacing={2}>
                <Skeleton variant="text" width={90} height={28} />
                <Skeleton variant="text" width="80%" />
                <Skeleton variant="text" width="70%" />
                <Skeleton variant="text" width={120} height={28} />
                <Skeleton variant="text" width={100} height={28} />
              </Stack>
            </Box>
          </Stack>
        </Paper>
      </Container>
    </>
  );
};
