import { z } from 'zod';

/**
 * A form as listed for administration, with its latest active version. The version fields are null for a form
 * without versions.
 */
export const FormListItem = z.object({
  form_id: z.number(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  is_public: z.boolean(),
  create_date: z.string(),
  form_version_id: z.number().nullable(),
  version_number: z.number().nullable(),
  record_effective_date: z.string().nullable()
});

export type FormListItem = z.infer<typeof FormListItem>;

/**
 * A form's identity, slug, owning contributor, administration team, descriptive metadata and access.
 */
export const Form = z.object({
  form_id: z.number(),
  slug: z.string(),
  contributor_id: z.number(),
  team_id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  is_public: z.boolean(),
  record_end_date: z.string().nullable()
});

export type Form = z.infer<typeof Form>;

/**
 * A revision of a form and the Blueprint it collects. `record_effective_date` is null while the version is a draft;
 * `record_end_date` is set once a newer version is published.
 */
export const FormVersion = z.object({
  form_version_id: z.number(),
  form_id: z.number(),
  blueprint_id: z.number(),
  version_number: z.number(),
  record_effective_date: z.string().nullable(),
  record_end_date: z.string().nullable()
});

export type FormVersion = z.infer<typeof FormVersion>;

/**
 * An active Blueprint feature type of a form version, with its section presentation. Presentation falls back to the
 * feature type's display name and to false flags when the section has not been configured.
 */
export const FormSectionRow = z.object({
  blueprint_feature_type_id: z.number(),
  feature_type_id: z.number(),
  feature_type_name: z.string(),
  feature_type_display_name: z.string(),
  label: z.string(),
  description: z.string().nullable(),
  required_value: z.boolean(),
  allow_multiple: z.boolean(),
  sort: z.number().nullable()
});

export type FormSectionRow = z.infer<typeof FormSectionRow>;

/**
 * An active Blueprint property assignment of a form version, with its field presentation. The label falls back to the
 * property's display name when the field has not been configured. A code-valued field names the codeset of the form's
 * contributor whose codes it accepts.
 */
export const FormFieldRow = z.object({
  blueprint_feature_type_property_id: z.number(),
  blueprint_feature_type_id: z.number(),
  feature_property_id: z.number(),
  feature_property_name: z.string(),
  feature_property_display_name: z.string(),
  type_name: z.string(),
  label: z.string(),
  description: z.string().nullable(),
  contributor_codeset_id: z.number().nullable(),
  sort: z.number().nullable()
});

export type FormFieldRow = z.infer<typeof FormFieldRow>;

/**
 * A team linked to a form for access control.
 */
export const FormTeam = z.object({
  team_id: z.string(),
  name: z.string()
});

export type FormTeam = z.infer<typeof FormTeam>;

/**
 * Filters for the administrative form list. Keyword matches the form name or slug case-insensitively.
 */
export interface FormFilters {
  keyword?: string;
}

/**
 * Field of a form section being saved. A code-valued field names a codeset of the form's contributor; every other
 * field names none.
 */
export interface SaveFormField {
  featurePropertyId: number;
  label: string;
  description: string | null;
  contributorCodesetId: number | null;
}

/**
 * Section of a form version being saved. Field order is the array order.
 */
export interface SaveFormSection {
  featureTypeId: number;
  label: string;
  description: string | null;
  requiredValue: boolean;
  allowMultiple: boolean;
  fields: SaveFormField[];
}

/**
 * The form metadata and complete layout of a draft version, as saved by the form builder. Section order is the array
 * order.
 */
export interface SaveFormVersion {
  name: string;
  description: string | null;
  isPublic: boolean;
  sections: SaveFormSection[];
}

/**
 * A new form and the layout of its first version. The slug and contributor are set here and cannot change afterwards.
 */
export interface CreateForm {
  slug: string;
  contributorId: number;
  name: string;
  description: string | null;
  isPublic: boolean;
  sections: SaveFormSection[];
}

/**
 * Form row accepted on insert.
 */
export interface InsertForm {
  slug: string;
  contributorId: number;
  teamId: string;
  name: string;
  description: string | null;
  isPublic: boolean;
}

/**
 * Mutable form metadata accepted on update.
 */
export interface UpdateForm {
  name: string;
  description: string | null;
  isPublic: boolean;
}

/**
 * Section presentation row accepted on insert.
 */
export interface InsertFormSection {
  formVersionId: number;
  blueprintFeatureTypeId: number;
  label: string;
  description: string | null;
  requiredValue: boolean;
  allowMultiple: boolean;
}

/**
 * Field presentation row accepted on insert.
 */
export interface InsertFormField {
  formVersionId: number;
  blueprintFeatureTypePropertyId: number;
  label: string;
  description: string | null;
  contributorCodesetId: number | null;
}

/**
 * A section of a form version with its fields, in display order.
 */
export interface FormSection extends FormSectionRow {
  fields: FormFieldRow[];
}

/**
 * A form version and its complete layout.
 */
export interface FormVersionLayout {
  form: Form;
  form_version: FormVersion;
  sections: FormSection[];
}
