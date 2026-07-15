import { z } from 'zod';

export const DownloadVersionExportArtifactRecord = z.object({
  download_version_export_artifact_id: z.string().uuid(),
  download_version_export_artifact_group_id: z.string().uuid(),
  artifact_id: z.string().uuid(),
  chunk_id: z.number()
});
export type DownloadVersionExportArtifactRecord = z.infer<typeof DownloadVersionExportArtifactRecord>;

/**
 * Join-readback shape returned by the repository's list-by-group method.
 *
 * Adds `byte_size` + `object_key` from the `artifact` row so the service layer can
 * build presigned URLs and size-reporting responses without a second round-trip.
 * The repo query filters `WHERE a.byte_size IS NOT NULL` so this shape can type
 * `byte_size` as non-null — pending/unuploaded artifacts never surface here.
 */
export const DownloadVersionExportArtifactWithFile = DownloadVersionExportArtifactRecord.extend({
  byte_size: z.string(),
  object_key: z.string()
});
export type DownloadVersionExportArtifactWithFile = z.infer<typeof DownloadVersionExportArtifactWithFile>;
