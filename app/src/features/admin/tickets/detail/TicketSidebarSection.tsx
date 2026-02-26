import { mdiPlus } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { PropsWithChildren } from 'react';

interface ITicketSidebarSectionProps {
  label: string;
  onAdd?: () => void;
}

/**
 * Reusable ticket sidebar section with optional add action.
 *
 * @param {PropsWithChildren<ITicketSidebarSectionProps>} props
 * @return {*}
 */
export const TicketSidebarSection = (props: PropsWithChildren<ITicketSidebarSectionProps>) => {
  const { label, onAdd, children } = props;

  return (
    <Stack spacing={1}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {label}
        </Typography>
        {onAdd ? (
          <IconButton size="small" onClick={onAdd} aria-label={`add ${label.toLowerCase()}`}>
            <Icon path={mdiPlus} size={0.8} />
          </IconButton>
        ) : null}
      </Box>

      <Box>{children}</Box>
    </Stack>
  );
};
