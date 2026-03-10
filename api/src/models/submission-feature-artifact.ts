import { z } from 'zod';

/**
 * SubmissionFeatureArtifact table schema
 */
export const SubmissionFeatureArtifact = z.object({
  submission_feature_artifact_id: z.number(),
  submission_feature_id: z.number(),
  artifact_id: z.string().uuid(),
  record_end_date: z.string().nullable()
});
export type SubmissionFeatureArtifact = z.infer<typeof SubmissionFeatureArtifact>;

/**
 * Payload for creating a new SubmissionFeatureArtifact
 */
export type CreateSubmissionFeatureArtifact = {
  submission_feature_id: number;
  artifact_id: string;
};

/**
 * Payload for updating an existing SubmissionFeatureArtifact
 */
export type UpdateSubmissionFeatureArtifact = {
  submission_feature_id?: number;
  artifact_id?: string;
  record_end_date?: string | null;
};
