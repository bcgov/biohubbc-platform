import { z } from 'zod';

/**
 * A feature type assigned to a specific blueprint, including joined global
 * feature type metadata for administrative display.
 */
export const BlueprintFeatureTypeAssignment = z.object({
  blueprint_feature_type_id: z.number(),
  blueprint_id: z.number(),
  feature_type_id: z.number(),
  name: z.string(),
  display_name: z.string(),
  description: z.string().nullable(),
  sort: z.number().int().nullable(),
  record_end_date: z.string().nullable()
});

export type BlueprintFeatureTypeAssignment = z.infer<typeof BlueprintFeatureTypeAssignment>;

/**
 * Reusable global definition exposed as an assignment selector option.
 */
export const BlueprintCompositionOption = z.object({
  id: z.number(),
  name: z.string(),
  display_name: z.string()
});

export type BlueprintCompositionOption = z.infer<typeof BlueprintCompositionOption>;

/**
 * Filters for blueprint composition assignments.
 * Keyword matches names and display names case-insensitively. Active true
 * restricts results to non-ended assignments; false or omission includes history.
 */
export interface BlueprintCompositionFilters {
  keyword?: string;
  active?: boolean;
}

/**
 * Request to assign a reusable feature type to a blueprint.
 */
export interface CreateBlueprintFeatureTypeAssignment {
  featureTypeId: number;
}
