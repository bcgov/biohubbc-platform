import { z } from 'zod';

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
