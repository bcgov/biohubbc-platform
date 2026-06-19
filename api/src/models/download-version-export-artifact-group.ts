import { z } from 'zod';
import { DownloadVersionExportMode, ExportConfig } from './download-export-config';
import { DownloadStatusZod } from './download-status';

/**
 * The reusable, materialized set of export artifacts for one download version, keyed by export
 * options. Exactly one active group exists per (version, format, mode, max_part_size_bytes,
 * exporter_version) — identical requests dedupe onto it rather than rebuilding. Lifecycle
 * status/timing/error live here (not on the per-user export) so a second request for the same shape
 * attaches to an already-`ready` group without re-running the pipeline.
 */
export const DownloadVersionExportArtifactGroupRecord = z.object({
  download_version_export_artifact_group_id: z.string().uuid(),
  download_version_id: z.string().uuid(),
  // The recipe, re-parsed back from the JSONB column.
  config: ExportConfig,
  // sha256 hex of the canonical config — the active-group dedupe key.
  config_hash: z.string(),
  format: z.string(),
  mode: DownloadVersionExportMode,
  // BIGINT → string via pg default INT8 parser.
  max_part_size_bytes: z.string(),
  exporter_version: z.number(),
  status: DownloadStatusZod,
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  error_message: z.string().nullable()
});
export type DownloadVersionExportArtifactGroupRecord = z.infer<typeof DownloadVersionExportArtifactGroupRecord>;
