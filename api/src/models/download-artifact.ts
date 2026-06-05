import { z } from 'zod';

export const DownloadArtifactRecord = z.object({
  download_artifact_id: z.number(),
  download_id: z.string(),
  artifact_id: z.string().uuid()
});
export type DownloadArtifactRecord = z.infer<typeof DownloadArtifactRecord>;
