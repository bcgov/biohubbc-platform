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

/**
 * Fields required to insert a blueprint-specific property assignment.
 */
export interface CreateBlueprintFeatureTypePropertyRecord {
  feature_property_id: number;
  required_value?: boolean;
  allow_multiple?: boolean;
  sort?: number | null;
  blueprint_feature_type_id: number;
}

export const Blueprint = z.object({
  blueprint_id: z.number(),
  name: z.string(),
  version_number: z.number(),
  description: z.string().nullable(),
  is_default: z.boolean(),
  parent_blueprint_id: z.number().nullable(),
  record_effective_date: z.string().nullable(),
  record_end_date: z.string().nullable()
});
export type Blueprint = z.infer<typeof Blueprint>;

export interface CreateBlueprint {
  name: string;
  description?: string | null;
  parentBlueprintId?: number | null;
  recordEffectiveDate?: string | null;
}

export interface UpdateBlueprint {
  name?: string;
  description?: string | null;
  parentBlueprintId?: number | null;
  recordEffectiveDate?: string | null;
}

export interface BlueprintFilters {
  keyword?: string;
}
