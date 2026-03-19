import { z } from 'zod';
import { FeaturePropertyTypeName } from './feature-property';

/**
 * Query row schema for feature type property metadata used during indexing.
 */
export const FeatureTypePropertyMetadata = z.object({
  feature_type_id: z.number(),
  feature_type_property_id: z.number(),
  allow_multiple: z.boolean(),
  feature_property_name: z.string(),
  feature_property_type_name: FeaturePropertyTypeName
});
export type FeatureTypePropertyMetadata = z.infer<typeof FeatureTypePropertyMetadata>;

/**
 * Query row schema for code slug resolution rows.
 */
export const ContributorCodeResolution = z.object({
  contributor_codeset_code_id: z.number(),
  contributor_codeset_key: z.string(),
  contributor_codeset_code_key: z.string()
});
export type ContributorCodeResolution = z.infer<typeof ContributorCodeResolution>;
