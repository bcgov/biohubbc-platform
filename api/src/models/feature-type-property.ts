import { z } from 'zod';
import { FEATURE_PROPERTY_TYPE } from './feature-property';

/**
 * Schema for feature property definition.
 * Represents an allowed property for a feature type.
 */
export const FeatureTypeProperty = z.object({
  feature_type_property_id: z.number(),
  feature_property_id: z.number().optional(),
  feature_property_type_id: z.number().optional(),
  name: z.string(),
  display_name: z.string(),
  description: z.string().nullable(),
  type_name: z.string(),
  required_value: z.boolean(),
  calculated_value: z.boolean(),
  allow_multiple: z.boolean()
});

export type FeatureTypeProperty = z.infer<typeof FeatureTypeProperty>;

export const ExpressionPredicatePropertyMetadata = z.object({
  feature_property_id: z.number().int().positive(),
  feature_type_property_id: z.number().int().positive().nullable(),
  feature_property_type_id: z.number().int().positive(),
  feature_property_type_name: z.union([
    z.literal(FEATURE_PROPERTY_TYPE.STRING),
    z.literal(FEATURE_PROPERTY_TYPE.NUMBER),
    z.literal(FEATURE_PROPERTY_TYPE.BOOLEAN),
    z.literal(FEATURE_PROPERTY_TYPE.SPATIAL),
    z.literal(FEATURE_PROPERTY_TYPE.DATETIME),
    z.literal(FEATURE_PROPERTY_TYPE.CODE),
    z.literal(FEATURE_PROPERTY_TYPE.TAXON)
  ]),
  display_name: z.string()
});

export type ExpressionPredicatePropertyMetadata = z.infer<typeof ExpressionPredicatePropertyMetadata>;

/**
 * Schema for a raw feature_type_property record used by admin CRUD endpoints.
 * Distinct from FeatureTypeProperty which is a denormalized view with joined property metadata.
 */
export const AdminFeatureTypeProperty = z.object({
  feature_type_property_id: z.number(),
  feature_type_id: z.number(),
  feature_property_id: z.number(),
  required_value: z.boolean(),
  sort: z.number().int().nullable()
});

export type AdminFeatureTypeProperty = z.infer<typeof AdminFeatureTypeProperty>;

/** Fields required to assign a feature property to a feature type. */
export interface CreateFeatureTypePropertyRecord {
  /** Parent feature type identifier. */
  feature_type_id: number;
  /** Feature property to assign. */
  feature_property_id: number;
  /** Whether the property is required for this feature type. */
  required_value?: boolean;
  /** Optional display sort order. */
  sort?: number | null;
}

/** Partial metadata fields accepted when updating a feature type property assignment. */
export interface UpdateFeatureTypePropertyRecord {
  required_value?: boolean;
  sort?: number | null;
  record_end_date?: string;
}
