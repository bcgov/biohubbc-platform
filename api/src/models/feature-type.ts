import { z } from 'zod';
import { FeaturePropertyDefinition, FeatureTypeProperty } from './feature-property';

/**
 * Schema for feature type basic info.
 */
export const FeatureType = z.object({
  record_effective_date: z.string().optional(),
  record_end_date: z.string().nullable().optional(),
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

/**
 * Feature type with every property ever assigned to it, as definitions rather than assignments.
 */
export const FeatureTypeWithPropertyDefinitions = z.object({
  feature_type: FeatureType,
  properties: z.array(FeaturePropertyDefinition)
});

export type FeatureTypeWithPropertyDefinitions = z.infer<typeof FeatureTypeWithPropertyDefinitions>;

/** Fields required to create a feature type. */
export interface CreateFeatureType {
  /** Canonical name of the feature type. */
  name: string;
  /** Human-readable display name. */
  display_name: string;
  /** Optional description. */
  description?: string | null;
}

/**
 * Editable presentation metadata; canonical names remain immutable.
 */
export interface UpdateFeatureType {
  display_name?: string;
  description?: string | null;
}
