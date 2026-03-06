import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export const TicketsNoRowsOverlay = () => {
  return (
    <Stack alignItems="center" justifyContent="center" p={3} height="100%">
      <Typography data-testid="tickets-empty-title" component="h2" sx={{ mb: 1, fontWeight: 700 }}>
        No tickets found
      </Typography>
      <Typography variant="body2" color="text.secondary">
        No tickets are available.
      </Typography>
    </Stack>
  );
};
