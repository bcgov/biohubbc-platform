import { z } from 'zod';

export const SubmissionFeaturePropertyBooleanSchema = z.object({
  submission_feature_property_boolean_id: z.number().int(),
  submission_feature_id: z.number().int(),
  feature_type_property_id: z.number().int(),
  value: z.boolean()
});

export type SubmissionFeaturePropertyBoolean = z.infer<typeof SubmissionFeaturePropertyBooleanSchema>;

export interface CreateSubmissionFeaturePropertyBoolean {
  submission_feature_id: number;
  feature_type_property_id: number;
  value: boolean;
}
