import { z } from 'zod';

// Search result schema
export const SearchFeatureResultWithRelevancy = z.object({
  submission_feature_id: z.number(),
  parent_submission_feature_id: z.number().nullable(),
  provenance: z.enum(['direct', 'inherited']).nullable(),
  submission_id: z.number(),
  uuid: z.string(),
  feature_type_id: z.number(),
  feature_type_name: z.string(),
  properties: z.record(z.string(), z.unknown()),
  submission_name: z.string(),
  is_secured: z.boolean(),
  relevancy_score: z.number(),
  create_date: z.string()
});

export type SearchFeatureResultWithRelevancy = z.infer<typeof SearchFeatureResultWithRelevancy>;
