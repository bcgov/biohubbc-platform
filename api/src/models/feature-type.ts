import { z } from 'zod';
import { FeatureTypeProperty } from './feature-type-property';

/**
 * Schema for feature type basic info.
 */
export const FeatureType = z.object({
  feature_type_id: z.number(),
  name: z.string(),
  display_name: z.string(),
  description: z.string().nullable()
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

/** Fields required to create a feature type. */
export interface CreateFeatureType {
  /** Canonical name of the feature type. */
  name: string;
  /** Human-readable display name. */
  display_name: string;
  /** Optional description. */
  description?: string | null;
}

/** Partial fields accepted when updating a feature type. */
export interface UpdateFeatureType {
  name?: string;
  display_name?: string;
  description?: string | null;
  record_end_date?: string;
}
