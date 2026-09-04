import { z } from 'zod';

export const SearchFeatureSort = z.enum(['submission_feature_id', 'create_date']);
export type SearchFeatureSort = z.infer<typeof SearchFeatureSort>;

export const SearchFeatureCursor = z.object({
  direction: z.enum(['next', 'previous']),
  submission_feature_id: z.number().int().positive(),
  create_date: z.string()
});
export type SearchFeatureCursor = z.infer<typeof SearchFeatureCursor>;

/**
 * Validated sorting and cursor values used to build a feature search query.
 */
export interface SearchFeatureQueryOptions {
  sort: SearchFeatureSort;
  order: 'asc' | 'desc';
  boundary?: SearchFeatureCursor;
  limit?: number;
}
