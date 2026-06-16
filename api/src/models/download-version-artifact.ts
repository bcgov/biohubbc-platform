import { z } from 'zod';

export const DownloadVersionArtifactRecord = z.object({
  download_version_artifact_id: z.string().uuid(),
  download_version_id: z.string().uuid(),
  artifact_id: z.string().uuid(),
  feature_type_name: z.string().nullable()
});
export type DownloadVersionArtifactRecord = z.infer<typeof DownloadVersionArtifactRecord>;
