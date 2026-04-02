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
 * feature_count removed — download_feature table dropped (SIMSBIOHUB-950).
 * Feature count is no longer cheaply derivable without the join table.
 */
export const DownloadListRecord = DownloadRecord;
export type DownloadListRecord = z.infer<typeof DownloadListRecord>;

/**
 * Internal row shape returned by the paginated list query.
 * Includes total_count from COUNT(*) OVER() window function — stripped before returning to callers.
 */
export const DownloadListRow = DownloadRecord.extend({
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
 * Minimal projection of a download record for feature resolution.
 * Used by DownloadService.getDownloadFeatures to branch between
 * cart-based (frozen snapshot) and filter-based (live re-query) paths.
 *
 * Includes create_user so the pipeline can recover the creator's security
 * context for filter-based re-queries without a separate round-trip.
 */
export const DownloadSource = z.object({
  cart_id: z.string().uuid().nullable(),
  filters: SearchFeatureFiltersSchema.nullable(),
  create_user: z.number()
});
export type DownloadSource = z.infer<typeof DownloadSource>;

/**
 * Payload for creating a new download record.
 *
 * Every download must have a feature source: either cartId (cart-based, frozen
 * at checkout) or filters (filter-based, re-derived at pipeline time).
 * Team linking is handled separately via download_team.
 */
export const CreateDownload = z.object({
  fragmentSizeBytes: z.number().optional(),
  filters: SearchFeatureFiltersSchema.optional(),
  cartId: z.string().uuid().optional()
});
export type CreateDownload = z.infer<typeof CreateDownload>;

export const DownloadTotalSize = z.object({ total: z.string().nullable() });
export type DownloadTotalSize = z.infer<typeof DownloadTotalSize>;

export const IsAuthorized = z.object({ authorized: z.boolean() });
export type IsAuthorized = z.infer<typeof IsAuthorized>;

export const HasTeams = z.object({ has_teams: z.boolean() });
export type HasTeams = z.infer<typeof HasTeams>;
