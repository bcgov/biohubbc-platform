import { z } from 'zod';

export const DownloadExportArtifactRecord = z.object({
  download_export_artifact_id: z.number(),
  download_export_id: z.string().uuid(),
  artifact_id: z.string().uuid(),
  chunk_id: z.number().nullable()
});
export type DownloadExportArtifactRecord = z.infer<typeof DownloadExportArtifactRecord>;

/**
 * Join-readback shape returned by `DownloadExportRepository.listDownloadExportArtifactsByExportId`.
 *
 * Adds `byte_size` + `object_key` from the `artifact` row so the service layer can
 * build presigned URLs and size-reporting responses without a second round-trip.
 * The repo query filters `WHERE a.byte_size IS NOT NULL` so this shape can type
 * `byte_size` as non-null — pending/unuploaded artifacts never surface here.
 */
export const DownloadExportArtifactWithFile = DownloadExportArtifactRecord.extend({
  byte_size: z.string(),
  object_key: z.string()
});
export type DownloadExportArtifactWithFile = z.infer<typeof DownloadExportArtifactWithFile>;
