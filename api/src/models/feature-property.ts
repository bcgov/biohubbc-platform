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
 * Reference-typed property values (code, taxon, feature) resolve to structured objects carrying a
 * display `label` alongside stable identifiers, so search results and feature detail can render the
 * label as a link/link-like element. Scalar-typed values remain plain strings.
 *
 * Shapes:
 * - code:    `{ codeset_key, codeset_label, code_key, code_label, label }`
 * - taxon:   `{ taxon_id, tsn, rank, label }`
 * - feature: `{ urn, label }`
 */
export const StructuredPropertyValue = z.object({ label: z.string() }).passthrough();

export type StructuredPropertyValue = z.infer<typeof StructuredPropertyValue>;

export const SubmissionFeatureProperty = z.object({
  id: z.string(),
  property: z.string(),
  value: z.union([z.string(), StructuredPropertyValue])
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
