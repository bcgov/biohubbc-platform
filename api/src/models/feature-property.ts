import { z } from 'zod';

export enum FEATURE_PROPERTY_TYPE {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  SPATIAL = 'spatial',
  DATETIME = 'datetime',
  CODE = 'code',
  TAXON = 'taxon',
  ARTIFACT_KEY = 'artifact_key'
}

export const FeaturePropertyTypeName = z.enum([
  'string',
  'number',
  'boolean',
  'spatial',
  'datetime',
  'code',
  'taxon',
  'artifact_key'
]);

/**
 * Structured value of a taxon-valued submitted property: a display `label` (ITIS scientific name,
 * which `taxon` stores NOT NULL) plus the identifiers the UI links with.
 */
export const TaxonPropertyValue = z.object({
  taxon_id: z.number(),
  tsn: z.number(),
  rank: z.string().nullable(),
  label: z.string()
});

export type TaxonPropertyValue = z.infer<typeof TaxonPropertyValue>;

/**
 * Structured value of a code-valued submitted property: the codeset and code keys and labels, with the
 * code label as the display `label`.
 */
export const CodePropertyValue = z.object({
  codeset_key: z.string(),
  codeset_label: z.string(),
  code_key: z.string(),
  code_label: z.string(),
  label: z.string()
});

export type CodePropertyValue = z.infer<typeof CodePropertyValue>;

/**
 * Structured value of a feature-valued submitted property: the referenced feature's URN, which is also
 * the display `label`.
 */
export const FeatureReferencePropertyValue = z.object({
  urn: z.string(),
  label: z.string()
});

export type FeatureReferencePropertyValue = z.infer<typeof FeatureReferencePropertyValue>;

/**
 * Value of an indexed submitted property as read by the feature-detail properties list.
 *
 * Scalar-typed values are plain strings; reference-typed values are structured objects that
 * always carry a `label` and are told apart by their identifier keys.
 */
export const SubmissionFeaturePropertyValue = z.union([
  z.string(),
  TaxonPropertyValue,
  CodePropertyValue,
  FeatureReferencePropertyValue
]);

export type SubmissionFeaturePropertyValue = z.infer<typeof SubmissionFeaturePropertyValue>;

export const SubmissionFeatureProperty = z.object({
  id: z.string(),
  property: z.string(),
  value: SubmissionFeaturePropertyValue
});

export type SubmissionFeatureProperty = z.infer<typeof SubmissionFeatureProperty>;

/**
 * Schema for a feature property record (includes resolved type_name from feature_property_type).
 */
export const FeatureProperty = z.object({
  feature_property_id: z.number(),
  feature_property_type_id: z.number(),
  name: z.string(),
  display_name: z.string(),
  description: z.string().nullable(),
  type_name: z.string(),
  calculated_value: z.boolean()
});

export type FeatureProperty = z.infer<typeof FeatureProperty>;

/** Fields required to create a feature property. */
export interface CreateFeatureProperty {
  /** Foreign key to feature_property_type. */
  feature_property_type_id: number;
  /** Canonical property name. */
  name: string;
  /** Human-readable display name. */
  display_name: string;
  /** Optional description. */
  description?: string | null;
  /** Whether values are calculated rather than supplied. */
  calculated_value?: boolean;
}

/** Partial fields accepted when updating a feature property. */
export interface UpdateFeatureProperty {
  name?: string;
  display_name?: string;
  description?: string | null;
  calculated_value?: boolean;
  record_end_date?: string;
}
