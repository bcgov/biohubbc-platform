import { z } from 'zod';

/**
 * Schema for a blueprint record used by admin endpoints.
 *
 * `record_effective_date` is null while the blueprint is a draft. Only drafts can be edited; a
 * published blueprint is changed by creating a new version from it.
 */
export const AdminBlueprint = z.object({
  blueprint_id: z.number(),
  version_number: z.number().int(),
  name: z.string(),
  description: z.string().nullable(),
  is_default: z.boolean(),
  parent_blueprint_id: z.number().nullable(),
  record_effective_date: z.string().nullable(),
  record_end_date: z.string().nullable()
});

export type AdminBlueprint = z.infer<typeof AdminBlueprint>;

/**
 * Schema for a feature type included in a blueprint, with the feature type's names joined in.
 */
export const AdminBlueprintFeatureType = z.object({
  blueprint_feature_type_id: z.number(),
  blueprint_id: z.number(),
  feature_type_id: z.number(),
  feature_type_name: z.string(),
  feature_type_display_name: z.string(),
  sort: z.number().int().nullable()
});

export type AdminBlueprintFeatureType = z.infer<typeof AdminBlueprintFeatureType>;

/**
 * Schema for a property assigned to a blueprint feature type, with the property's names and type
 * joined in.
 *
 * `feature_property_id` identifies the reusable property definition the assignment configures.
 * `feature_type_property_id` is the compatibility reference to the global pairing, retained until
 * that table is removed.
 */
export const AdminBlueprintFeatureTypeProperty = z.object({
  blueprint_feature_type_property_id: z.number(),
  blueprint_feature_type_id: z.number(),
  feature_property_id: z.number(),
  feature_type_property_id: z.number(),
  property_name: z.string(),
  property_display_name: z.string(),
  property_type_name: z.string(),
  required_value: z.boolean(),
  allow_multiple: z.boolean(),
  sort: z.number().int().nullable()
});

export type AdminBlueprintFeatureTypeProperty = z.infer<typeof AdminBlueprintFeatureTypeProperty>;

/**
 * Optional overrides accepted when creating a new draft version from an existing blueprint. An omitted
 * field is inherited from the source blueprint.
 */
export interface CreateBlueprintVersionRecord {
  name?: string;
  description?: string;
}

/** Options accepted when publishing a draft blueprint. */
export interface PublishBlueprintRecord {
  /** Whether the published blueprint becomes the default for new submissions. */
  is_default?: boolean;
}

/** Fields required to include a feature type in a blueprint. */
export interface CreateBlueprintFeatureTypeRecord {
  blueprint_id: number;
  feature_type_id: number;
  sort?: number | null;
}

/** Fields accepted when updating a blueprint feature type. */
export interface UpdateBlueprintFeatureTypeRecord {
  sort?: number | null;
}

/** Fields accepted from a client when assigning a property to a blueprint feature type. */
export interface CreateBlueprintFeatureTypePropertyRequest {
  feature_property_id: number;
  required_value?: boolean;
  allow_multiple?: boolean;
  sort?: number | null;
}

/** Fields required to insert a blueprint feature type property assignment. */
export interface CreateBlueprintFeatureTypePropertyRecord extends CreateBlueprintFeatureTypePropertyRequest {
  blueprint_feature_type_id: number;
  /** Compatibility reference to the global pairing; resolved by the service, never supplied by a client. */
  feature_type_property_id: number;
}

/** Fields accepted when updating a blueprint feature type property assignment. */
export interface UpdateBlueprintFeatureTypePropertyRecord {
  required_value?: boolean;
  allow_multiple?: boolean;
  sort?: number | null;
}
