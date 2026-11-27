import { ICreateForm, IFormVersionLayout, ISaveFormVersion } from 'interfaces/useFormsApi.interface';

/** A field of a section in the form builder. A code field names a codeset of the form's contributor. */
export interface IFormLayoutField {
  featurePropertyId: number;
  displayName: string;
  typeName: string;
  label: string;
  description: string | null;
  contributorCodesetId: number | null;
}

/** A section of the form builder. A feature type appears in a form at most once, so it identifies the section. */
export interface IFormLayoutSection {
  featureTypeId: number;
  displayName: string;
  label: string;
  description: string | null;
  requiredValue: boolean;
  allowMultiple: boolean;
  fields: IFormLayoutField[];
}

/** The form builder's working copy of a form version. */
export interface IFormLayout {
  /** Null until the form is first saved. */
  formId: number | null;
  /** Null until the form is first saved. */
  formVersionId: number | null;
  /** Set before the first save; fixed afterwards. */
  slug: string;
  /** Set before the first save; fixed afterwards. */
  contributorId: number | null;
  /** The form administration team. Null until the form is first saved. */
  teamId: string | null;
  name: string;
  description: string | null;
  isPublic: boolean;
  /** Null until the form is first saved. */
  versionNumber: number | null;
  isPublished: boolean;
  /** Whether a newer published version has replaced this one. */
  isRetired: boolean;
  sections: IFormLayoutSection[];
}

/** The section, and optionally the field within it, being configured. */
export interface IFormLayoutSelection {
  featureTypeId: number;
  featurePropertyId: number | null;
}

export const EMPTY_FORM_LAYOUT: IFormLayout = {
  formId: null,
  formVersionId: null,
  slug: '',
  contributorId: null,
  teamId: null,
  name: '',
  description: null,
  isPublic: false,
  versionNumber: null,
  isPublished: false,
  isRetired: false,
  sections: []
};

/**
 * Build the builder's working copy from a saved form version.
 *
 * @param {IFormVersionLayout} layout Saved form version layout.
 * @returns {IFormLayout} Working copy.
 */
export const toFormLayout = (layout: IFormVersionLayout): IFormLayout => ({
  formId: layout.form.form_id,
  formVersionId: layout.form_version.form_version_id,
  slug: layout.form.slug,
  contributorId: layout.form.contributor_id,
  teamId: layout.form.team_id,
  name: layout.form.name,
  description: layout.form.description,
  isPublic: layout.form.is_public,
  versionNumber: layout.form_version.version_number,
  isPublished: layout.form_version.record_effective_date !== null,
  isRetired: layout.form_version.record_end_date !== null,
  sections: layout.sections.map((section) => ({
    featureTypeId: section.feature_type_id,
    displayName: section.feature_type_display_name,
    label: section.label,
    description: section.description,
    requiredValue: section.required_value,
    allowMultiple: section.allow_multiple,
    fields: section.fields.map((field) => ({
      featurePropertyId: field.feature_property_id,
      displayName: field.feature_property_display_name,
      typeName: field.type_name,
      label: field.label,
      description: field.description,
      contributorCodesetId: field.contributor_codeset_id
    }))
  }))
});

/**
 * Build the save payload from the builder's working copy.
 *
 * @param {IFormLayout} layout Working copy.
 * @returns {ISaveFormVersion} Save payload.
 */
export const toSaveFormVersion = (layout: IFormLayout): ISaveFormVersion => ({
  name: layout.name,
  description: layout.description,
  isPublic: layout.isPublic,
  sections: layout.sections.map((section) => ({
    featureTypeId: section.featureTypeId,
    label: section.label,
    description: section.description,
    requiredValue: section.requiredValue,
    allowMultiple: section.allowMultiple,
    fields: section.fields.map((field) => ({
      featurePropertyId: field.featurePropertyId,
      label: field.label,
      description: field.description,
      contributorCodesetId: field.contributorCodesetId
    }))
  }))
});

/**
 * Build the create payload from the builder's working copy of an unsaved form, whose details include a contributor.
 *
 * @param {IFormLayout} layout Working copy.
 * @returns {ICreateForm} Create payload.
 */
export const toCreateForm = (layout: IFormLayout): ICreateForm => ({
  slug: layout.slug,
  contributorId: Number(layout.contributorId),
  ...toSaveFormVersion(layout)
});

/**
 * Move a section to the position of another section.
 *
 * @param {IFormLayoutSection[]} sections Sections in display order.
 * @param {number} draggedFeatureTypeId Section being moved.
 * @param {number} targetFeatureTypeId Section whose position it takes.
 * @returns {IFormLayoutSection[]} Reordered sections.
 */
export const moveSection = (
  sections: IFormLayoutSection[],
  draggedFeatureTypeId: number,
  targetFeatureTypeId: number
): IFormLayoutSection[] => {
  const fromIndex = sections.findIndex((section) => section.featureTypeId === draggedFeatureTypeId);
  const toIndex = sections.findIndex((section) => section.featureTypeId === targetFeatureTypeId);

  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
    return sections;
  }

  const reordered = [...sections];
  const [moved] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, moved);

  return reordered;
};
