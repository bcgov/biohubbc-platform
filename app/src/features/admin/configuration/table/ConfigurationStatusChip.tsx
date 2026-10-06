import Chip, { ChipProps } from '@mui/material/Chip';
import { ConfigurationStatus } from '../utils/lifecycleStatus';

const statusColors: Record<ConfigurationStatus, ChipProps['color']> = {
  Active: 'success',
  Scheduled: 'info',
  Draft: 'default',
  Retired: 'default'
};

/**
 * Display a Configuration lifecycle status using the ticket status-chip styling.
 *
 * @param props Prepared record status.
 * @returns Consistent status label and colour across Configuration tables.
 */
export const ConfigurationStatusChip = ({ status }: { status: ConfigurationStatus }) => (
  <Chip
    label={status}
    size="small"
    color={statusColors[status]}
    sx={{ fontWeight: 700, textTransform: 'capitalize', ...(status === 'Draft' && { color: 'inherit' }) }}
  />
);
