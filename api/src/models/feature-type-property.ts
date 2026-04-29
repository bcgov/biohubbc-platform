import { z } from 'zod';

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
  description: z.string(),
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
  type_name: z.enum(['string', 'number', 'boolean', 'spatial', 'datetime', 'code', 'taxon']),
  display_name: z.string()
});

export type ExpressionPredicatePropertyMetadata = z.infer<typeof ExpressionPredicatePropertyMetadata>;
