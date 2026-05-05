import { z } from 'zod';
import { DownloadExportListRow } from './download-export';
import { DownloadStatusZod } from './download-status';

export const DownloadRecord = z.object({
  download_id: z.string(),
  download_status: DownloadStatusZod,
  format: z.string(),
  metadata: z.object({}).passthrough().nullable(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  downloaded_at: z.string().nullable(),
  create_date: z.string()
});
export type DownloadRecord = z.infer<typeof DownloadRecord>;

/**
 * Repo-layer list-row shape, returned by `DownloadRepository.getDownloadsByTeamMembership`
 * before service-layer enrichment. Service adds `exports[]` to produce `DownloadListRecord`.
 */
export const DownloadListRecordBase = DownloadRecord;
export type DownloadListRecordBase = z.infer<typeof DownloadListRecordBase>;

/**
 * Service-layer (and public API) list-row shape. `exports[]` is attached by
 * `DownloadService.getDownloadsByTeamMembership` via a parallel batch-fetch from
 * `DownloadExportService` and grouped by download_id in JS. Mirrors the assembly
 * pattern used by `TicketService.getTicket` (`ticket-service.ts`) — composed at
 * the service layer rather than via SQL aggregation so repositories stay
 * single-SQL CRUD.
 */
export const DownloadListRecord = DownloadListRecordBase.extend({
  exports: z.array(DownloadExportListRow)
});
export type DownloadListRecord = z.infer<typeof DownloadListRecord>;

/**
 * Internal row shape returned by the paginated list query. Carries `total_count`
 * from the COUNT(*) OVER() window — stripped before returning to callers. Does
 * NOT carry `exports`; those are fetched separately and attached in the service.
 */
export const DownloadListRow = DownloadListRecordBase.extend({
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

/**
 * Minimal projection of a download record for export-time pipeline evaluation.
 *
 * `policy_id` resolves to the policy whose statements drive what to export.
 * `create_user` carries the policy creator's identity so the pipeline can
 * apply the security filter at export time using the user's authorization
 * scope at the moment of export — not at create time.
 */
export const DownloadSource = z.object({
  policy_id: z.string().uuid(),
  create_user: z.number()
});
export type DownloadSource = z.infer<typeof DownloadSource>;

/**
 * Payload for creating a new download record. The download's feature set is
 * defined by the referenced policy; format is the export wire format.
 */
export const CreateDownload = z.object({
  policyId: z.string().uuid(),
  format: z.string()
});
export type CreateDownload = z.infer<typeof CreateDownload>;

export const IsAuthorized = z.object({ authorized: z.boolean() });
export type IsAuthorized = z.infer<typeof IsAuthorized>;

export const HasTeams = z.object({ has_teams: z.boolean() });
export type HasTeams = z.infer<typeof HasTeams>;

/**
 * Artifact info for the Parquet pipeline — the S3 location where Parquet files are written.
 * JOINs download_artifact to artifact to get the object key.
 */
export const DownloadArtifactInfo = z.object({
  artifact_id: z.string().uuid(),
  object_key: z.string()
});
export type DownloadArtifactInfo = z.infer<typeof DownloadArtifactInfo>;

/**
 * Row shape for the Parquet download pipeline.
 *
 * Mirrors DownloadFeatureData but uses `parent_uuid` instead of full parent denormalization.
 * Each Parquet file contains one feature type — parent data lives in its own file,
 * joined by `parent_uuid` (star schema, not flattened).
 *
 * `data` is a record of property names to typed JS values, reconstructed from the
 * typed `submission_feature_property_*` tables. Code properties contain the resolved
 * label (not the FK), taxon properties contain the scientific name (not taxon_id).
 */
export const ParquetFeatureData = z.object({
  submission_feature_id: z.number(),
  uuid: z.string(),
  feature_type_name: z.string(),
  data: z.record(z.any()),
  parent_uuid: z.string().nullable()
});
export type ParquetFeatureData = z.infer<typeof ParquetFeatureData>;
