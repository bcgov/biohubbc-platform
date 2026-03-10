import { z } from 'zod';

export const SubmissionFeaturePropertyNumberSchema = z.object({
  submission_feature_property_number_id: z.number().int(),
  submission_feature_id: z.number().int(),
  feature_type_property_id: z.number().int(),
  value: z.number()
});

export type SubmissionFeaturePropertyNumber = z.infer<typeof SubmissionFeaturePropertyNumberSchema>;

export interface CreateSubmissionFeaturePropertyNumber {
  submission_feature_id: number;
  feature_type_property_id: number;
  value: number;
}
