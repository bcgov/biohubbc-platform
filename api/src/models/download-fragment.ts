import { z } from 'zod';
import { DownloadStatusZod } from './download-status';

export const DownloadFragmentRecord = z.object({
  download_fragment_id: z.number(),
  download_id: z.number(),
  fragment_index: z.number(),
  fragment_status: DownloadStatusZod,
  s3_key: z.string().nullable(),
  file_name: z.string().nullable(),
  file_size_bytes: z.string().nullable(),
  estimated_size_bytes: z.string().nullable(),
  feature_count: z.number(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  error_message: z.string().nullable()
});
export type DownloadFragmentRecord = z.infer<typeof DownloadFragmentRecord>;

export const DownloadFragmentId = DownloadFragmentRecord.pick({ download_fragment_id: true });
export type DownloadFragmentId = z.infer<typeof DownloadFragmentId>;
