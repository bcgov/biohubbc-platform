import { z } from 'zod';

export const SearchFeatureSort = z.enum(['submission_feature_id', 'create_date']);
export type SearchFeatureSort = z.infer<typeof SearchFeatureSort>;

export const SearchFeatureCursor = z.object({
  direction: z.enum(['next', 'previous']),
  submission_feature_id: z.number().int().positive(),
  create_date: z.string()
});
export type SearchFeatureCursor = z.infer<typeof SearchFeatureCursor>;
