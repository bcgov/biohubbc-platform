import { z } from 'zod';
import { DownloadStatusZod } from './download-status';

export const DownloadRecord = z.object({
  download_id: z.number(),
  system_user_id: z.number(),
  download_status: DownloadStatusZod,
  s3_key: z.string().nullable(),
  file_name: z.string().nullable(),
  file_size_bytes: z.number().nullable(),
  metadata: z.record(z.unknown()).nullable(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  downloaded_at: z.string().nullable(),
  total_fragments: z.number(),
  completed_fragments: z.number(),
  estimated_total_size_bytes: z.number().nullable(),
  fragment_size_bytes: z.number()
});
export type DownloadRecord = z.infer<typeof DownloadRecord>;

export const DownloadId = DownloadRecord.pick({ download_id: true });
export type DownloadId = z.infer<typeof DownloadId>;

export const DownloadFeatureRecord = z.object({
  download_feature_id: z.number(),
  download_id: z.number(),
  submission_feature_id: z.number()
});
export type DownloadFeatureRecord = z.infer<typeof DownloadFeatureRecord>;

export const DownloadFeatureData = z.object({
  submission_feature_id: z.number(),
  submission_id: z.number(),
  feature_type_name: z.string(),
  data: z.record(z.any()),
  artifact_byte_size: z.number().nullable(),
  // Parent denormalization columns - present when feature has a parent
  parent_data: z.record(z.any()).nullable().optional(),
  parent_feature_type_name: z.string().nullable().optional()
});
export type DownloadFeatureData = z.infer<typeof DownloadFeatureData>;
