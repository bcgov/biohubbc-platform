import { z } from 'zod';

export const SubmissionFeaturePropertyTaxonSchema = z.object({
  submission_feature_property_taxon_id: z.number().int(),
  submission_feature_id: z.number().int(),
  blueprint_feature_type_property_id: z.number().int(),
  taxon_id: z.number().int()
});

export type SubmissionFeaturePropertyTaxon = z.infer<typeof SubmissionFeaturePropertyTaxonSchema>;

export interface CreateSubmissionFeaturePropertyTaxon {
  submission_feature_id: number;
  blueprint_feature_type_property_id: number;
  taxon_id: number;
}
