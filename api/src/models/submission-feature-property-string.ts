import { z } from 'zod';

export const SubmissionFeaturePropertyStringSchema = z.object({
  submission_feature_property_string_id: z.number().int(),
  submission_feature_id: z.number().int(),
  feature_type_property_id: z.number().int(),
  value: z.string()
});

export type SubmissionFeaturePropertyString = z.infer<typeof SubmissionFeaturePropertyStringSchema>;

export interface CreateSubmissionFeaturePropertyString {
  submission_feature_id: number;
  feature_type_property_id: number;
  value: string;
}
