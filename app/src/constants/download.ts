import { ChipProps } from '@mui/material';

export const DOWNLOAD_STATUS_CHIP_PROPS: Record<string, { color: ChipProps['color']; label: string }> = {
  pending: { color: 'default', label: 'Pending' },
  processing: { color: 'info', label: 'Processing' },
  ready: { color: 'success', label: 'Ready' },
  downloaded: { color: 'success', label: 'Downloaded' },
  failed: { color: 'error', label: 'Failed' }
};

/**
 * Chip variants for `download_export.status`. No `'downloaded'` entry — exports never reach
 * that state; `'downloaded'` is a `download`-only terminal.
 */
export const EXPORT_STATUS_CHIP_PROPS: Record<string, { color: ChipProps['color']; label: string }> = {
  pending: { color: 'default', label: 'Pending' },
  processing: { color: 'info', label: 'Processing' },
  ready: { color: 'success', label: 'Ready' },
  failed: { color: 'error', label: 'Failed' }
};
