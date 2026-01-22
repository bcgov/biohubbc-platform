import { z } from 'zod';

/**
 * Schema for feature property definition.
 * Represents an allowed property for a feature type.
 */
export const FeatureProperty = z.object({
  name: z.string(),
  display_name: z.string(),
  description: z.string(),
  type_name: z.string(),
  required_value: z.boolean()
});

export type FeatureProperty = z.infer<typeof FeatureProperty>;

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
 * Schema for raw DB row when querying feature type with properties.
 * Used for Zod validation of the JOIN query result.
 */
export const FeatureTypeWithPropertiesRow = z.object({
  feature_type_id: z.number(),
  name: z.string(),
  display_name: z.string(),
  property_name: z.string().nullable(),
  property_display_name: z.string().nullable(),
  property_description: z.string().nullable(),
  property_type_name: z.string().nullable(),
  required_value: z.boolean().nullable()
});

export type FeatureTypeWithPropertiesRow = z.infer<typeof FeatureTypeWithPropertiesRow>;

/**
 * Feature type with its associated properties.
 * Transformed result after processing raw DB rows.
 */
export const FeatureTypeWithProperties = z.object({
  featureType: FeatureTypeSummary,
  properties: z.array(FeatureProperty)
});

export type FeatureTypeWithProperties = z.infer<typeof FeatureTypeWithProperties>;
