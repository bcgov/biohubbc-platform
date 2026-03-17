import { z } from 'zod';

export const SubmissionFeaturePropertyCodeSchema = z.object({
  submission_feature_property_code_id: z.number().int(),
  submission_feature_id: z.number().int(),
  feature_type_property_id: z.number().int(),
  code_id: z.number().int()
});

export type SubmissionFeaturePropertyCode = z.infer<typeof SubmissionFeaturePropertyCodeSchema>;

export interface CreateSubmissionFeaturePropertyCode {
  submission_feature_id: number;
  feature_type_property_id: number;
  code_id: number;
}
