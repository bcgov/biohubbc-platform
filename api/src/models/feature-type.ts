import { z } from 'zod';

/**
 * Schema for feature property definition.
 * Represents an allowed property for a feature type.
 */
export const FeatureTypeProperty = z.object({
  feature_type_property_id: z.number(),
  name: z.string(),
  display_name: z.string(),
  description: z.string(),
  type_name: z.string(),
  required_value: z.boolean(),
  calculated_value: z.boolean()
});

export type FeatureTypeProperty = z.infer<typeof FeatureTypeProperty>;

/**
 * Schema for feature type basic info (minimal fields).
 * Use FeatureTypeRecord from submission-repository for full database record.
 */
export const FeatureTypeSummary = z.object({
  feature_type_id: z.number(),
  name: z.string(),
  display_name: z.string()
});

export type FeatureTypeSummary = z.infer<typeof FeatureTypeSummary>;

/**
 * Schema for aggregated DB row when querying feature type with properties.
 * SQL uses JSON_AGG to return properties as a JSON array in a single row.
 */
export const FeatureTypeWithPropertiesRow = z.object({
  feature_type_id: z.number(),
  name: z.string(),
  display_name: z.string(),
  properties: z.array(FeatureTypeProperty)
});

export type FeatureTypeWithPropertiesRow = z.infer<typeof FeatureTypeWithPropertiesRow>;

/**
 * Feature type with its associated properties.
 */
export const FeatureTypeWithProperties = z.object({
  featureType: FeatureTypeSummary,
  properties: z.array(FeatureTypeProperty)
});

export type FeatureTypeWithProperties = z.infer<typeof FeatureTypeWithProperties>;
