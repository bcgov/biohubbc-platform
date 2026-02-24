import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { SxProps, Theme } from '@mui/material/styles';
import { HTMLAttributes } from 'react';

type TicketsNoRowsOverlayProps = HTMLAttributes<HTMLDivElement> & {
  sx?: SxProps<Theme>;
  emptyTitle?: string;
  emptyMessage?: string;
};

export const TicketsNoRowsOverlay = (props: TicketsNoRowsOverlayProps) => {
  const { emptyTitle, emptyMessage } = props;

  return (
    <Stack alignItems="center" justifyContent="center" p={3} minHeight={220}>
      <Typography data-testid="tickets-empty-title" component="h2" sx={{ mb: 1, fontWeight: 700 }}>
        {emptyTitle ?? 'No tickets found'}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {emptyMessage ?? 'No tickets are available.'}
      </Typography>
    </Stack>
  );
};
