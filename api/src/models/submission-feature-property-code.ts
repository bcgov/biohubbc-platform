import { z } from 'zod';

export const SubmissionFeaturePropertyCodeSchema = z.object({
  submission_feature_property_code_id: z.number().int(),
  submission_feature_id: z.number().int(),
  blueprint_feature_type_property_id: z.number().int(),
  contributor_codeset_code_id: z.number().int()
});

export type SubmissionFeaturePropertyCode = z.infer<typeof SubmissionFeaturePropertyCodeSchema>;

export interface CreateSubmissionFeaturePropertyCode {
  submission_feature_id: number;
  blueprint_feature_type_property_id: number;
  contributor_codeset_code_id: number;
}
