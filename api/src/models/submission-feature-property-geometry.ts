import { z } from 'zod';

export const SubmissionFeaturePropertyGeometrySchema = z.object({
  submission_feature_property_geometry_id: z.number().int(),
  submission_feature_id: z.number().int(),
  feature_type_property_id: z.number().int(),
  value: z.record(z.string(), z.any())
});

export type SubmissionFeaturePropertyGeometry = z.infer<typeof SubmissionFeaturePropertyGeometrySchema>;

export interface CreateSubmissionFeaturePropertyGeometry {
  submission_feature_id: number;
  feature_type_property_id: number;
  value: Record<string, unknown>;
}
