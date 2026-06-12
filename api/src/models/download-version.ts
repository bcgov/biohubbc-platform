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
  download_version_id: z.string().uuid(),
  download_id: z.string().uuid()
});
export type DownloadVersionRecord = z.infer<typeof DownloadVersionRecord>;

/**
 * The version's own materialization-lifecycle status row, read directly by version id — the version
 * (not the download) owns the lifecycle, so status/timing/error live here.
 */
export const DownloadVersionStatusRecord = z.object({
  download_version_id: z.string().uuid(),
  download_id: z.string().uuid(),
  status: DownloadStatusZod,
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  materialized_at: z.string().nullable(),
  error_message: z.string().nullable()
});
export type DownloadVersionStatusRecord = z.infer<typeof DownloadVersionStatusRecord>;
