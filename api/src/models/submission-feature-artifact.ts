import { z } from 'zod';

export const SubmissionFeatureArtifact = z.object({
  submission_feature_artifact_id: z.number().int(),
  submission_feature_id: z.number().int(),
  artifact_id: z.string().uuid()
});

export type SubmissionFeatureArtifact = z.infer<typeof SubmissionFeatureArtifact>;

export interface CreateSubmissionFeatureArtifact {
  submission_feature_id: number;
  artifact_id: string;
}
