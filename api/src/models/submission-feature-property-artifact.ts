import { z } from 'zod';

export const SubmissionFeaturePropertyArtifact = z.object({
  submission_feature_property_artifact_id: z.number().int(),
  submission_feature_id: z.number().int(),
  feature_type_property_id: z.number().int(),
  artifact_id: z.string().uuid()
});

export type SubmissionFeaturePropertyArtifact = z.infer<typeof SubmissionFeaturePropertyArtifact>;

export interface CreateSubmissionFeaturePropertyArtifact {
  submission_feature_id: number;
  feature_type_property_id: number;
  artifact_id: string;
}
