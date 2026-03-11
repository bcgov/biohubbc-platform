import { z } from 'zod';
import { SearchFeatureFiltersSchema } from '../services/search-feature-service.interface';
import { DownloadStatusZod } from './download-status';

export const DownloadRecord = z.object({
  download_id: z.string(),
  download_status: DownloadStatusZod,
  metadata: z.object({}).passthrough().nullable(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  downloaded_at: z.string().nullable(),
  total_fragments: z.number(),
  completed_fragments: z.number(),
  estimated_total_size_bytes: z.string().nullable(),
  fragment_size_bytes: z.string(),
  create_date: z.string()
});
export type DownloadRecord = z.infer<typeof DownloadRecord>;

/**
 * Extended download record for the list endpoint.
 * Includes feature_count — the number of submission_feature records linked to the download (AC #1).
 */
export const DownloadListRecord = DownloadRecord.extend({
  feature_count: z.number()
});
export type DownloadListRecord = z.infer<typeof DownloadListRecord>;

/**
 * Internal row shape returned by the paginated list query.
 * Includes total_count from COUNT(*) OVER() window function — stripped before returning to callers.
 */
export const DownloadListRow = DownloadListRecord.extend({
  total_count: z.number()
});
export type DownloadListRow = z.infer<typeof DownloadListRow>;

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

/**
 * Result of estimating a download's total size before processing.
 * Used by planFragments to decide how to split features across zip files.
 *
 * Per-feature and total sizes are computed inline in the SQL query.
 */
export interface DownloadSizeEstimate {
  /** Total estimated bytes across all features. */
  totalEstimatedBytes: number;
  /** The features included in this download with per-feature estimated_byte_size. */
  features: DownloadFeatureSummary[];
}

/**
 * Payload for creating a new download record.
 *
 * Team linking is handled separately via download_team — callers insert
 * into the join table after creating the download record.
 */
export const CreateDownload = z.object({
  fragmentSizeBytes: z.number().optional(),
  filters: SearchFeatureFiltersSchema.optional()
});
export type CreateDownload = z.infer<typeof CreateDownload>;

/**
 * Payload for creating a download request through the pipeline.
 *
 * Accepted by the pipeline service's public entry point. Includes the feature
 * selection and optional fragment sizing before the request is persisted and
 * features are linked. Team linking is handled by the caller via download_team.
 */
export const CreateDownloadRequest = z.object({
  submissionFeatureIds: z.array(z.number()),
  fragmentSizeMb: z.number().optional(),
  filters: SearchFeatureFiltersSchema.optional()
});
export type CreateDownloadRequest = z.infer<typeof CreateDownloadRequest>;
