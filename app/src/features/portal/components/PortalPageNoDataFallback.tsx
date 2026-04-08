import { mdiTextBoxOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

/**
 * Empty state component displayed when the user has no submissions on the portal page.
 */
export const PortalPageNoDataFallback = () => (
  <>
    <Box pb={4}>
      <Typography variant="h4" component="h2">
        No records found
      </Typography>
    </Box>
    <Stack alignItems="center" justifyContent="center" p={3} component={Paper} elevation={0} minHeight={168}>
      <Box
        sx={{
          '& svg': {
            color: 'text.secondary'
          }
        }}>
        <Icon path={mdiTextBoxOutline} size={2} />
      </Box>
      <Typography component="h2" variant="h4" fontWeight={700} sx={{ mb: 1 }}>
        No submissions found
      </Typography>
      <Typography variant="body2" color="textSecondary">
        You have not submitted any data to BioHub yet.
      </Typography>
    </Stack>
  </>
);
