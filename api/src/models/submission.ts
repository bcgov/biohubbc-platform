import { z } from 'zod';

export interface SubmissionFilters {
  search?: string;
}

export const SubmissionFeatureForReview = z.object({
  submission_id: z.number().int(),
  submission_feature_id: z.number().int(),
  feature_type_name: z.string(),
  feature_type_id: z.number().int(),
  secured: z.boolean()
});

export type SubmissionFeatureForReview = z.infer<typeof SubmissionFeatureForReview>;
