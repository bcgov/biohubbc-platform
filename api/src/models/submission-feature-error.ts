import { z } from 'zod';
import { ApiPaginationResults } from '../zod-schema/pagination';

/** Sortable columns of the administrative submission feature error list. */
export const SUBMISSION_FEATURE_ERROR_SORT_COLUMNS = ['count', 'error_code', 'feature_type_name', 'property_name'];

/** An aggregated ingestion error of a submission upload, as shown in the administrative upload view. */
export const SubmissionFeatureError = z.object({
  submission_feature_error_id: z.number(),
  error_code: z.string(),
  error_message: z.string(),
  feature_type_name: z.string().nullable(),
  property_name: z.string().nullable(),
  count: z.number()
});

export type SubmissionFeatureError = z.infer<typeof SubmissionFeatureError>;

export interface SubmissionFeatureErrorsResponse {
  errors: SubmissionFeatureError[];
  pagination: ApiPaginationResults;
}
