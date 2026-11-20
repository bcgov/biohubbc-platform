import { z } from 'zod';

export const DownloadVersionArtifactRecord = z.object({
  download_version_artifact_id: z.guid(),
  download_version_id: z.guid(),
  artifact_id: z.guid(),
  feature_type_name: z.string().nullable()
});
export type DownloadVersionArtifactRecord = z.infer<typeof DownloadVersionArtifactRecord>;
