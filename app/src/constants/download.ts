import { ChipProps } from '@mui/material';
import { type DownloadRecord, type DownloadStatus } from 'interfaces/useDownloadApi.interface';
import { type DownloadExportStatus } from 'interfaces/useDownloadExportApi.interface';

type DownloadStatusChipProps = { color: ChipProps['color']; label: string };

export const DOWNLOAD_STATUS_CHIP_PROPS: Record<DownloadRecord['download_status'], DownloadStatusChipProps> = {
  pending: { color: 'default', label: 'Pending' },
  processing: { color: 'info', label: 'Processing' },
  ready: { color: 'success', label: 'Ready' },
  downloaded: { color: 'success', label: 'Downloaded' },
  failed: { color: 'error', label: 'Failed' }
};

/**
 * Status-to-body-copy mapping shown beside the download status chip on the
 * download page. `pending` and `processing` share copy because the
 * distinction is internal to the worker; `ready` and `downloaded` share copy
 * because both mean the parquet is available.
 */
export const DOWNLOAD_STATUS_BODY_COPY: Record<DownloadRecord['download_status'], string> = {
  pending: 'Preparing your download…',
  processing: 'Preparing your download…',
  ready: 'Your download is ready.',
  downloaded: 'Your download is ready.',
  failed: 'This download failed. Please try again from search.'
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

export const DOWNLOAD_TABLE_STATUS_CHIP_COLORS: Record<
  DownloadStatus | DownloadExportStatus,
  DownloadStatusChipProps['color']
> = {
  pending: 'warning',
  processing: 'info',
  ready: 'success',
  downloaded: 'default',
  failed: 'error'
};
