import { z } from 'zod';
import { GeoJSONGeometryZodSchema } from '../zod-schema/geoJsonZodSchema';

export const SubmissionFeaturePropertyGeometrySchema = z.object({
  submission_feature_property_geometry_id: z.number().int(),
  submission_feature_id: z.number().int(),
  feature_type_property_id: z.number().int(),
  value: GeoJSONGeometryZodSchema
});

export type SubmissionFeaturePropertyGeometry = z.infer<typeof SubmissionFeaturePropertyGeometrySchema>;

/**
 * Combined extent of a submission feature's active spatial properties.
 *
 * The bounds are null when the feature has no active spatial properties, which is the same condition
 * as `geometry_count` being zero.
 */
export const SubmissionFeatureGeometryExtentSchema = z.object({
  min_x: z.number().nullable(),
  min_y: z.number().nullable(),
  max_x: z.number().nullable(),
  max_y: z.number().nullable(),
  geometry_count: z.number().int()
});

export type SubmissionFeatureGeometryExtent = z.infer<typeof SubmissionFeatureGeometryExtentSchema>;

/**
 * Bounding box as [minX, minY, maxX, maxY] in WGS84.
 */
export type GeometryBoundingBox = [number, number, number, number];

export interface CreateSubmissionFeaturePropertyGeometry {
  submission_feature_id: number;
  feature_type_property_id: number;
  value: Record<string, unknown>;
}
