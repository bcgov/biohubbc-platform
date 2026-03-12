import { z } from 'zod';

/**
 * Query row schema for feature type property metadata used during indexing.
 */
export const FeatureTypePropertyMetadata = z.object({
  feature_type_id: z.number(),
  feature_type_property_id: z.number(),
  allow_multiple: z.boolean(),
  feature_property_name: z.string(),
  feature_property_type_name: z.string()
});
export type FeatureTypePropertyMetadata = z.infer<typeof FeatureTypePropertyMetadata>;

/**
 * Query row schema for contributor_codeset rows.
 */
export const ContributorCodeset = z.object({
  contributor_codeset_id: z.number(),
  contributor_id: z.number(),
  key: z.string(),
  label: z.string(),
  description: z.string().nullable(),
  external_id: z.string()
});
export type ContributorCodeset = z.infer<typeof ContributorCodeset>;

/**
 * Query row schema for contributor_codeset_code rows.
 */
export const ContributorCodesetCode = z.object({
  contributor_codeset_code_id: z.number(),
  contributor_codeset_id: z.number(),
  key: z.string(),
  label: z.string(),
  description: z.string().nullable(),
  external_id: z.string()
});
export type ContributorCodesetCode = z.infer<typeof ContributorCodesetCode>;

/**
 * Query row schema for code slug resolution rows.
 */
export const ContributorCodeResolution = z.object({
  contributor_codeset_code_id: z.number(),
  contributor_codeset_key: z.string(),
  contributor_codeset_code_key: z.string()
});
export type ContributorCodeResolution = z.infer<typeof ContributorCodeResolution>;

/**
 * Payload to create/reuse a contributor_codeset definition.
 *
 * Not validated with Zod because this is an internal TypeScript payload.
 */
export interface CreateContributorCodeset {
  contributor_id: number;
  key: string;
  external_id: string;
  label: string;
  description: string | null;
}

/**
 * Payload to create/reuse a contributor_codeset_code definition.
 *
 * Not validated with Zod because this is an internal TypeScript payload.
 */
export interface CreateContributorCodesetCode {
  contributor_codeset_id: number;
  contributor_codeset_key: string;
  key: string;
  external_id: string;
  label: string;
  description: string | null;
}
