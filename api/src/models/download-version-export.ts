import { z } from 'zod';
import { DownloadStatusZod } from './download-status';

/**
 * Export shape discriminator.
 *
 * `per_feature_type` — one logical CSV per feature type (star shape). The only value
 * currently written; the `mode` column and CHECK constraint land now so a future
 * denormalized-mode addition is strictly additive (data, not schema, change).
 */
export const DownloadVersionExportMode = z.enum(['per_feature_type', 'denormalized']);
export type DownloadVersionExportMode = z.infer<typeof DownloadVersionExportMode>;

/**
 * Thin row returned by the `download_version_export` INSERT RETURNING — the table's own columns only.
 */
export const DownloadVersionExportRow = z.object({
  download_version_export_id: z.string().uuid(),
  download_version_id: z.string().uuid(),
  download_version_export_artifact_group_id: z.string().uuid(),
  format: z.string(),
  mode: DownloadVersionExportMode,
  // BIGINT → string via pg default INT8 parser.
  max_part_size_bytes: z.string()
});
export type DownloadVersionExportRow = z.infer<typeof DownloadVersionExportRow>;

/**
 * Full API shape for a version export — the client-facing contract.
 *
 * Omits the two internal FKs the thin row carries (`download_version_id` and the artifact-group id):
 * those are temporal/dedup machinery the client never needs, so they stay server-side rather than
 * leaking into the response. Adds five query-derived fields, NONE of which are columns on
 * `download_version_export`:
 *
 * - `download_id` is reached through the version → download chain.
 * - `status` / `started_at` / `completed_at` / `error_message` are surfaced from the artifact GROUP
 *   via JOIN. Lifecycle state lives on the group, never the per-user export — attaching a new export
 *   to an already-`ready` group yields a `ready` export with no status write.
 */
export const DownloadVersionExportRecord = DownloadVersionExportRow.omit({
  download_version_id: true,
  download_version_export_artifact_group_id: true
}).extend({
  download_id: z.string().uuid(),
  status: DownloadStatusZod,
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  error_message: z.string().nullable()
});
export type DownloadVersionExportRecord = z.infer<typeof DownloadVersionExportRecord>;

/**
 * HTTP body shape for the create-export endpoint.
 *
 * `download_version_id` is REQUIRED — the caller names the materialized version to export. An export
 * binds to one materialized snapshot, so the caller, not the server, picks which version; a re-export
 * of an older version stays reproducible rather than silently retargeting the latest. `max_part_size_bytes`
 * stays optional (defaulted at the service layer). `mode` is deliberately NOT exposed; the service
 * hard-codes `per_feature_type` until a second shape ships.
 */
export const CreateDownloadVersionExportRequest = DownloadVersionExportRow.pick({
  max_part_size_bytes: true
})
  .partial()
  .extend({ download_version_id: z.string().uuid() });
export type CreateDownloadVersionExportRequest = z.infer<typeof CreateDownloadVersionExportRequest>;

/**
 * Service-layer payload passed to the repository INSERT.
 *
 * Service applies the max-part-size default and hard-codes `format='csv'` + `mode='per_feature_type'`.
 * Literals pin the single-shape contract; a future change would widen `mode` to the full enum.
 *
 * `download_version_export_artifact_group_id` is NON-nullable here even though the DB column is
 * nullable: the service resolver always materializes-or-finds the active group and sets it before
 * insert, so an export is never persisted without a group.
 */
export const CreateDownloadVersionExportPayload = z.object({
  download_version_id: z.string().uuid(),
  format: z.literal('csv'),
  mode: z.literal('per_feature_type'),
  max_part_size_bytes: z.string(),
  download_version_export_artifact_group_id: z.string().uuid()
});
export type CreateDownloadVersionExportPayload = z.infer<typeof CreateDownloadVersionExportPayload>;

/**
 * Row shape returned by the list endpoint. `part_count` is a LEFT JOIN COUNT on the group's
 * artifacts (derived at query time, never persisted) — lets the card render single-vs-multi-part UI
 * without a round-trip to the detail endpoint.
 */
export const DownloadVersionExportListRow = DownloadVersionExportRecord.extend({
  part_count: z.number().int().nonnegative()
});
export type DownloadVersionExportListRow = z.infer<typeof DownloadVersionExportListRow>;
