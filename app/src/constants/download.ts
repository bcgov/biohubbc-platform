import { ChipProps } from '@mui/material';
import { ToggleButtonView } from 'components/toggle-button/ToggleButtons';
import { type DownloadRecord } from 'interfaces/useDownloadApi.interface';
import { type DownloadExportStatus } from 'interfaces/useDownloadExportApi.interface';

type DownloadStatusChipProps = { color: ChipProps['color']; label: string };

export enum DOWNLOAD_SIDEBAR_VIEW {
  CART = 'cart',
  DOWNLOADS = 'downloads'
}

export const DOWNLOAD_SIDEBAR_VIEWS: ToggleButtonView<DOWNLOAD_SIDEBAR_VIEW>[] = [
  { value: DOWNLOAD_SIDEBAR_VIEW.CART, label: 'Cart' },
  { value: DOWNLOAD_SIDEBAR_VIEW.DOWNLOADS, label: 'Downloads' }
];

export const DOWNLOAD_STATUS_CHIP_PROPS: Record<DownloadRecord['download_status'], DownloadStatusChipProps> = {
  pending: { color: 'default', label: 'Pending' },
  processing: { color: 'info', label: 'Processing' },
  ready: { color: 'success', label: 'Ready' },
  downloaded: { color: 'success', label: 'Downloaded' },
  failed: { color: 'error', label: 'Failed' }
};

/**
 * Chip variants for `download_export.status`.
 */
export const EXPORT_STATUS_CHIP_PROPS: Record<DownloadExportStatus, DownloadStatusChipProps> = {
  pending: { color: 'default', label: 'Pending' },
  processing: { color: 'info', label: 'Processing' },
  ready: { color: 'success', label: 'Ready' },
  failed: { color: 'error', label: 'Failed' }
};
