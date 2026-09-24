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
 * A reusable property assigned to a specific blueprint feature type.
 * Membership and settings belong only to this blueprint assignment; no global
 * feature type/property membership is implied.
 */
export const BlueprintFeaturePropertyAssignment = z.object({
  blueprint_feature_type_property_id: z.number(),
  blueprint_feature_type_id: z.number(),
  feature_property_id: z.number(),
  feature_type_name: z.string(),
  name: z.string(),
  display_name: z.string(),
  description: z.string().nullable(),
  type_name: z.string(),
  required_value: z.boolean(),
  allow_multiple: z.boolean(),
  sort: z.number().int().nullable(),
  record_end_date: z.string().nullable()
});

export type BlueprintFeaturePropertyAssignment = z.infer<typeof BlueprintFeaturePropertyAssignment>;

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

/**
 * Request to assign a reusable property to a blueprint feature type.
 * Membership exists only within the referenced blueprint feature type assignment.
 * Omitted flags default to false.
 */
export interface CreateBlueprintFeaturePropertyAssignment {
  blueprintFeatureTypeId: number;
  featurePropertyId: number;
  requiredValue?: boolean;
  allowMultiple?: boolean;
}

/**
 * Editable settings for a property assignment with immutable membership.
 * Omitted fields preserve existing values. Flags accept only
 * booleans, including false to clear either setting.
 */
export interface UpdateBlueprintFeaturePropertyAssignment {
  requiredValue?: boolean;
  allowMultiple?: boolean;
}

/**
 * Property membership search within an optional feature-type assignment.
 */
export interface BlueprintFeaturePropertyFilters extends BlueprintCompositionFilters {
  blueprintFeatureTypeId?: number;
}
