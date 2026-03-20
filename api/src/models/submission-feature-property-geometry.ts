import { Feature } from 'geojson';
import { z } from 'zod';

export const SubmissionFeaturePropertyGeometry = z.object({
  submission_feature_property_geometry_id: z.number().int(),
  submission_feature_id: z.number().int(),
  feature_type_property_id: z.number().int(),
  value: z.record(z.string(), z.any())
});

export type SubmissionFeaturePropertyGeometry = z.infer<typeof SubmissionFeaturePropertyGeometry>;

export interface CreateSubmissionFeaturePropertyGeometry {
  submission_feature_id: number;
  feature_type_property_id: number;
  value: Feature;
}
