import { z } from 'zod';
import { DownloadStatusZod } from './download-status';

export const DownloadRecord = z.object({
  download_id: z.string(),
  system_user_id: z.number().nullable(),
  team_id: z.string().nullable(),
  data_request_id: z.string().nullable(),
  download_status: DownloadStatusZod,
  metadata: z.object({}).passthrough().nullable(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  downloaded_at: z.string().nullable(),
  total_fragments: z.number(),
  completed_fragments: z.number(),
  estimated_total_size_bytes: z.string().nullable(),
  fragment_size_bytes: z.string()
});
export type DownloadRecord = z.infer<typeof DownloadRecord>;

export const DownloadId = DownloadRecord.pick({ download_id: true });
export type DownloadId = z.infer<typeof DownloadId>;

export const DownloadFeatureData = z.object({
  submission_feature_id: z.number(),
  submission_id: z.number(),
  uuid: z.string(),
  feature_type_name: z.string(),
  data: z.record(z.any()),
  // Parent denormalization columns - present when feature has a parent
  parent_data: z.record(z.any()).nullable().optional(),
  parent_feature_type_name: z.string().nullable().optional()
});
export type DownloadFeatureData = z.infer<typeof DownloadFeatureData>;

export const DownloadFeatureSummary = z.object({
  submission_feature_id: z.number(),
  submission_id: z.number(),
  feature_type_name: z.string(),
  estimated_byte_size: z.string()
});
export type DownloadFeatureSummary = z.infer<typeof DownloadFeatureSummary>;
