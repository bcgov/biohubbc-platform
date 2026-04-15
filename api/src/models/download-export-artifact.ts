import { z } from 'zod';

export const DownloadExportArtifactRecord = z.object({
  download_export_artifact_id: z.number(),
  download_export_id: z.string().uuid(),
  artifact_id: z.string().uuid(),
  chunk_id: z.number().nullable()
});
export type DownloadExportArtifactRecord = z.infer<typeof DownloadExportArtifactRecord>;
