import { z } from 'zod';
import { FeatureTypeProperty } from './feature-type-property';

/**
 * Schema for feature type basic info.
 */
export const FeatureType = z.object({
  feature_type_id: z.number(),
  name: z.string(),
  display_name: z.string()
});

export type FeatureType = z.infer<typeof FeatureType>;

/**
 * Feature type with its associated properties.
 */
export const FeatureTypeWithProperties = z.object({
  feature_type: FeatureType,
  properties: z.array(FeatureTypeProperty)
});

export type FeatureTypeWithProperties = z.infer<typeof FeatureTypeWithProperties>;
