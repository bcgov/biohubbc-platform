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
