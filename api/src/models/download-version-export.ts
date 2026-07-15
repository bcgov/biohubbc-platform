import { z } from 'zod';
import { DownloadVersionExportMode, ExportConfig } from './download-export-config';
import { DownloadStatusZod } from './download-status';

export { DownloadVersionExportMode };

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
 * HTTP body shape for the create-export endpoint: the full export recipe
 * (`ExportConfig`) plus one optional packaging knob, `max_part_size_bytes`.
 *
 * `download_version_id` is REQUIRED — the caller names the materialized version to export. An export
 * binds to one materialized snapshot, so the caller, not the server, picks which version; a re-export
 * of an older version stays reproducible rather than silently retargeting the latest.
 *
 * `max_part_size_bytes` (BIGINT-as-string, optional, defaulted at the service layer) is the ONLY field
 * outside the recipe. It controls how the artifact bytes are split into parts — packaging, not content —
 * so the service strips both it AND `download_version_id` before canonicalizing and hashing the recipe.
 * Keeping them out of the hash means two requests that differ only in part size (or that name the same
 * version) still resolve to the same reusable artifact group.
 */
export const CreateDownloadVersionExportRequest = ExportConfig.and(
  z.object({
    download_version_id: z.string().uuid(),
    max_part_size_bytes: z.string().optional()
  })
);
export type CreateDownloadVersionExportRequest = z.infer<typeof CreateDownloadVersionExportRequest>;

/**
 * Service-layer payload passed to the repository INSERT.
 *
 * `format` is the literal `'csv'` (driven by the recipe's `export_type`), while `mode` carries
 * whatever the validated recipe resolved to — `per_feature_type` or `denormalized` — so it is the
 * full enum, not a pinned literal. The service applies the max-part-size default before insert.
 *
 * `download_version_export_artifact_group_id` is NON-nullable here even though the DB column is
 * nullable: the service resolver always materializes-or-finds the active group and sets it before
 * insert, so an export is never persisted without a group.
 */
export const CreateDownloadVersionExportPayload = z.object({
  download_version_id: z.string().uuid(),
  format: z.literal('csv'),
  mode: DownloadVersionExportMode,
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

/**
 * One feature type a download's current version can export, with the exact set of columns the CSV
 * pipeline can materialize for it. Backs the export-recipe picker.
 *
 * Not a DB row — it has no table or column. `columns` is the structural columns
 * (`submission_feature_id` / `uuid` / `parent_uuid`) followed by the schema-derived headers, the
 * identical set the per-type CSV writer emits (`materializedColumnsForType`). Offering anything the
 * pipeline can't produce would let a recipe reference a column the CSV never carries.
 */
export const DownloadExportFeatureType = z.object({
  feature_type: z.string(),
  columns: z.array(z.string())
});
export type DownloadExportFeatureType = z.infer<typeof DownloadExportFeatureType>;
