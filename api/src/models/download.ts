import { z } from 'zod';
import { DownloadExportListRow } from './download-export';
import { DownloadStatusZod } from './download-status';
import { ExpressionTree } from './expression-tree';

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
 * Detail-row shape returned by `DownloadRepository.findDownloadById`. Extends
 * `DownloadRecord` with the owning policy's display fields (`name`,
 * `description`), which are joined in via `LEFT JOIN biohub.policy` on the
 * detail query only. The LIST query does not join `policy`, so the base
 * `DownloadRecord` stays untouched and the list-row schemas (built off
 * `DownloadListRecordBase = DownloadRecord`) continue to parse cleanly.
 */
export const DownloadDetailRecord = DownloadRecord.extend({
  current_download_version_id: z.string().uuid().nullable(),
  name: z.string(),
  description: z.string().nullable()
});
export type DownloadDetailRecord = z.infer<typeof DownloadDetailRecord>;

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
 * `requested_by` is the security identity the export is built with: the
 * requesting user for an authenticated download. It drives the parquet security
 * filter — the pipeline judges feature visibility against this identity's
 * authorization scope. Distinct from the audit `create_user` (who inserted the
 * row); for an authenticated download they coincide, but the security filter
 * must read `requested_by` so the identity stays decoupled from the inserting
 * connection's grants.
 *
 * `requested_by` is nullable: NULL means an anonymous (public-by-link) download
 * with no security identity, and the pipeline evaluates it as unsecured-only.
 * Must stay nullable — coercing NULL to a real user id would filter by that
 * user's grants and leak secured data into a public-by-link download.
 */
export const DownloadSource = z.object({
  policy_id: z.string().uuid(),
  requested_by: z.number().nullable()
});
export type DownloadSource = z.infer<typeof DownloadSource>;

/**
 * Payload for creating a new download record. The download's feature set is
 * defined by the referenced policy; format is the export wire format.
 *
 * `requestedBy` is the security identity the resulting export is filtered for —
 * persisted to `download.requested_by` and used by the parquet pipeline, not the
 * audit `create_user`.
 *
 * `requestedBy` is nullable: NULL means an anonymous (public-by-link) download
 * with no security identity, and the pipeline evaluates it as unsecured-only.
 * Must stay nullable — coercing NULL to a real user id would filter by that
 * user's grants and leak secured data into a public-by-link download.
 */
export const CreateDownload = z.object({
  policyId: z.string().uuid(),
  format: z.string(),
  requestedBy: z.number().nullable()
});
export type CreateDownload = z.infer<typeof CreateDownload>;

/**
 * HTTP request body for `POST /api/download`.
 *
 * `name` is capped at 100 to match the underlying `biohub.policy.name varchar(100)`
 * column — the route boundary rejects too-long names rather than letting the DB
 * surface the violation as a 500.
 *
 * `.strict()` rejects unknown keys: silent acceptance of `ui_id` and similar
 * leakage masks frontend decoder bugs. Failing fast at the boundary points the
 * FE at its own bug rather than letting bad data flow into a policy.
 */
export const CreateDownloadRequestBody = z
  .object({
    name: z.string().min(1).max(100),
    description: z.string().max(1000).nullable().optional(),
    featureTypes: z.array(z.string()).min(1),
    expression: ExpressionTree.nullable()
  })
  .strict();
export type CreateDownloadRequestBody = z.infer<typeof CreateDownloadRequestBody>;

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
