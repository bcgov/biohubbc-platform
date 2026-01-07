import { z } from 'zod';

export const WithCount = <T extends z.ZodTypeAny>(model: T) =>
  z.object({
    data: z.array(model),
    total: z.number().int().nonnegative()
  });

export type WithCount<T extends z.ZodTypeAny> = z.infer<ReturnType<typeof WithCount<T>>>;

export const SearchFeatureResult = z.object({
  submission_feature_id: z.number().int().positive(),
  feature_type_id: z.number().int(),
  label: z.string()
});
export type SearchFeatureResult = z.infer<typeof SearchFeatureResult>;

export const SearchFeatureResultWithCount = WithCount(SearchFeatureResult);
export type SearchFeatureResultWithCount = z.infer<typeof SearchFeatureResultWithCount>;

export const SearchSubmissionResult = z.object({
  submission_id: z.number().int().positive(),
  name: z.string(),
  description: z.string().optional().nullable()
});
export type SearchSubmissionResult = z.infer<typeof SearchSubmissionResult>;

export const SearchSubmissionResultWithCount = WithCount(SearchSubmissionResult);
export type SearchSubmissionResultWithCount = z.infer<typeof SearchSubmissionResultWithCount>;

export const SearchTaxonResult = z.object({
  taxon_id: z.number().int().positive(),
  itis_scientific_name: z.string()
});
export type SearchTaxonResult = z.infer<typeof SearchTaxonResult>;

export const SearchTaxonResultWithCount = WithCount(SearchTaxonResult);
export type SearchTaxonResultWithCount = z.infer<typeof SearchTaxonResultWithCount>;

export const SearchResponse = z.object({
  features: z.array(SearchFeatureResult),
  submissions: z.array(SearchSubmissionResult),
  taxonomy: z.array(SearchTaxonResult)
});
export type SearchResponse = z.infer<typeof SearchResponse>;

export const SearchSummaryFeature = z.object({
  feature_type_name: z.string(),
  total: z.number().int().nonnegative()
});
export type SearchSummaryFeature = z.infer<typeof SearchSummaryFeature>;

export const SearchSummarySubmission = z.object({
  total: z.number().int().nonnegative().optional()
});
export type SearchSummarySubmission = z.infer<typeof SearchSummarySubmission>;

export const SearchSummaryTaxon = z.object({
  total: z.number().int().nonnegative().optional()
});

export type SearchSummaryTaxon = z.infer<typeof SearchSummaryTaxon>;

export const SearchSummaryResponse = z.object({
  features: z.array(SearchSummaryFeature),
  submissions: SearchSummarySubmission,
  taxonomy: SearchSummaryTaxon
});
export type SearchSummaryResponse = z.infer<typeof SearchSummaryResponse>;
