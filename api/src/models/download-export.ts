import { z } from 'zod';
import { DownloadStatusZod } from './download-status';

export const DownloadExportRecord = z.object({
  download_export_id: z.string().uuid(),
  download_id: z.string(),
  format: z.string(),
  status: DownloadStatusZod,
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  error_message: z.string().nullable()
});
export type DownloadExportRecord = z.infer<typeof DownloadExportRecord>;

export const DownloadExportId = DownloadExportRecord.pick({ download_export_id: true });
export type DownloadExportId = z.infer<typeof DownloadExportId>;
