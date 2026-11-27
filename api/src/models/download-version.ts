import { z } from 'zod';
import { DownloadStatusZod } from './download-status';

/**
 * A download_version is the temporal axis of a download. Re-running the same invariant policy at a
 * later point creates a new version that re-snapshots the download to pick up newly uploaded
 * features. The policy itself is never recorded per version — only the materialized artifacts are.
 *
 * Minimal shape: these two columns are what the repository's INSERT RETURNING selects.
 */
export const DownloadVersionRecord = z.object({
  download_version_id: z.guid(),
  download_id: z.guid()
});
export type DownloadVersionRecord = z.infer<typeof DownloadVersionRecord>;

/**
 * The version's own materialization-lifecycle status row, read directly by version id — the version
 * (not the download) owns the lifecycle, so status/timing/error live here.
 */
export const DownloadVersionStatusRecord = z.object({
  download_version_id: z.guid(),
  download_id: z.guid(),
  status: DownloadStatusZod,
  feature_count: z.number().nullable(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  materialized_at: z.string().nullable(),
  error_message: z.string().nullable(),
  create_date: z.string()
});
export type DownloadVersionStatusRecord = z.infer<typeof DownloadVersionStatusRecord>;

/**
 * One feature of a download version, as the version's feature list returns it. The list reads the
 * version's stored feature set in SQL; the set itself (`download_version.feature_ids`) is never
 * selected into a row.
 */
export const DownloadVersionFeature = z.object({
  submission_feature_id: z.number().int(),
  uuid: z.guid(),
  submission_id: z.number().int(),
  feature_type_id: z.number().int(),
  feature_type_name: z.string()
});
export type DownloadVersionFeature = z.infer<typeof DownloadVersionFeature>;
