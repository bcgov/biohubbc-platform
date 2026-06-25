import { z } from 'zod';
import { GeoJSONGeometryZodSchema } from '../zod-schema/geoJsonZodSchema';

export const SubmissionFeaturePropertyGeometrySchema = z.object({
  submission_feature_property_geometry_id: z.number().int(),
  submission_feature_id: z.number().int(),
  blueprint_feature_type_property_id: z.number().int(),
  value: GeoJSONGeometryZodSchema
});

export type SubmissionFeaturePropertyGeometry = z.infer<typeof SubmissionFeaturePropertyGeometrySchema>;

export interface CreateSubmissionFeaturePropertyGeometry {
  submission_feature_id: number;
  blueprint_feature_type_property_id: number;
  value: Record<string, unknown>;
}
