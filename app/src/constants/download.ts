import { ChipProps } from '@mui/material';

export const DOWNLOAD_STATUS_CHIP_PROPS: Record<string, { color: ChipProps['color']; label: string }> = {
  pending: { color: 'default', label: 'Pending' },
  processing: { color: 'info', label: 'Processing' },
  ready: { color: 'success', label: 'Ready' },
  downloaded: { color: 'success', label: 'Downloaded' },
  failed: { color: 'error', label: 'Failed' }
};
