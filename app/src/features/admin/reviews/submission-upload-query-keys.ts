import { QUERY_KEY_ROOT } from 'constants/query-keys';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { ApiCursorPaginationRequestOptions, ApiPaginationRequestOptions } from 'types/pagination';

/** Identifies one submission upload. */
export interface SubmissionUploadKeyScope {
  submissionId: number;
  submissionUploadId: string;
}

/** Identifies one review of a submission upload. */
export interface SubmissionUploadReviewKeyScope extends SubmissionUploadKeyScope {
  submissionUploadReviewId: string;
}

/** Inputs that decide which rule assignment states a review's rules grid shows. */
export interface SelectedFeatureRulesKeyParams {
  /** Selected features; empty means the applied expression, or the whole upload without one. */
  featureIds: number[];
  /** Applied expression, used only when no features are selected. */
  expression: ExpressionTreeExpression | null | undefined;
  /** Applied rule-name search. */
  keyword: string;
  pagination: ApiPaginationRequestOptions;
}

/**
 * Key of everything cached for one submission upload.
 *
 * @param {SubmissionUploadKeyScope} scope The upload.
 * @returns The key prefix shared by every query about the upload.
 */
const upload = (scope: SubmissionUploadKeyScope) =>
  [QUERY_KEY_ROOT.SUBMISSION_UPLOAD, scope.submissionId, scope.submissionUploadId] as const;

/**
 * Key of everything cached for one review of an upload.
 *
 * @param {SubmissionUploadReviewKeyScope} scope The review.
 * @returns The key prefix shared by every query about the review.
 */
const review = (scope: SubmissionUploadReviewKeyScope) =>
  [...upload(scope), 'review', scope.submissionUploadReviewId] as const;

/**
 * Key of one review's detail.
 *
 * @param {SubmissionUploadReviewKeyScope} scope The review.
 * @returns The review detail key.
 */
const reviewDetail = (scope: SubmissionUploadReviewKeyScope) => [...review(scope), 'detail'] as const;

/**
 * Key prefix of every security-rule query for one review: the rules grid for any scope, and each
 * feature's own rules. A change to rule assignments invalidates this prefix, or the narrower one below.
 *
 * @param {SubmissionUploadReviewKeyScope} scope The review.
 * @returns The security-rules key prefix.
 */
const securityRules = (scope: SubmissionUploadReviewKeyScope) => [...review(scope), 'security-rules'] as const;

/**
 * Key of the rules grid for one applied scope, search and page.
 *
 * Feature ids are sorted so the same selection made in a different order shares an entry.
 *
 * @param {SubmissionUploadReviewKeyScope} scope The review.
 * @param {SelectedFeatureRulesKeyParams} params The applied scope, search and page.
 * @returns The rules grid key.
 */
const selectedFeatureRules = (scope: SubmissionUploadReviewKeyScope, params: SelectedFeatureRulesKeyParams) =>
  [
    ...securityRules(scope),
    'selected',
    {
      featureIds: [...params.featureIds].sort((a, b) => a - b),
      expression: params.expression ?? null,
      keyword: params.keyword,
      pagination: params.pagination
    }
  ] as const;

/**
 * Key prefix of every feature's own rule list in one review.
 *
 * @param {SubmissionUploadReviewKeyScope} scope The review.
 * @returns The per-feature rules key prefix.
 */
const featureRulesAll = (scope: SubmissionUploadReviewKeyScope) => [...securityRules(scope), 'feature'] as const;

/**
 * Key of one page of the rules affecting one feature.
 *
 * @param {SubmissionUploadReviewKeyScope} scope The review.
 * @param {number} submissionFeatureId The feature.
 * @param {ApiPaginationRequestOptions} pagination The page.
 * @returns The feature rules key.
 */
const featureRules = (
  scope: SubmissionUploadReviewKeyScope,
  submissionFeatureId: number,
  pagination: ApiPaginationRequestOptions
) => [...featureRulesAll(scope), submissionFeatureId, { pagination }] as const;

/**
 * Key prefix of the upload's feature search: the count and every page of results.
 *
 * @param {SubmissionUploadKeyScope} scope The upload.
 * @returns The feature search key prefix.
 */
const featureSearch = (scope: SubmissionUploadKeyScope) => [...upload(scope), 'features', 'search'] as const;

/**
 * Key of the number of upload features matching an applied expression.
 *
 * @param {SubmissionUploadKeyScope} scope The upload.
 * @param {ExpressionTreeExpression | null} expression The applied expression, or null for every feature.
 * @returns The feature count key.
 */
const featureSearchCount = (scope: SubmissionUploadKeyScope, expression: ExpressionTreeExpression | null) =>
  [...featureSearch(scope), 'count', { expression }] as const;

/**
 * Key prefix of every page of feature search results. Security changes reclassify features, so they
 * invalidate this prefix; they do not change which features match, so the count is left alone.
 *
 * @param {SubmissionUploadKeyScope} scope The upload.
 * @returns The feature search results key prefix.
 */
const featureSearchResultsAll = (scope: SubmissionUploadKeyScope) => [...featureSearch(scope), 'results'] as const;

/**
 * Key of one page of upload features matching an applied expression.
 *
 * @param {SubmissionUploadKeyScope} scope The upload.
 * @param {ExpressionTreeExpression | null} expression The applied expression, or null for every feature.
 * @param {ApiCursorPaginationRequestOptions} pagination The cursor page.
 * @returns The feature search results key.
 */
const featureSearchResults = (
  scope: SubmissionUploadKeyScope,
  expression: ExpressionTreeExpression | null,
  pagination: ApiCursorPaginationRequestOptions
) => [...featureSearchResultsAll(scope), { expression, pagination }] as const;

/**
 * Key prefix of everything cached for one upload feature.
 *
 * @param {SubmissionUploadKeyScope} scope The upload.
 * @param {number | null} submissionFeatureId The feature, or null where no feature is selected and the
 * query is skipped.
 * @returns The feature key prefix.
 */
const feature = (scope: SubmissionUploadKeyScope, submissionFeatureId: number | null) =>
  [...upload(scope), 'features', submissionFeatureId] as const;

/**
 * Key of one upload feature's detail.
 *
 * @param {SubmissionUploadKeyScope} scope The upload.
 * @param {number} submissionFeatureId The feature.
 * @returns The feature detail key.
 */
const featureDetail = (scope: SubmissionUploadKeyScope, submissionFeatureId: number) =>
  [...feature(scope, submissionFeatureId), 'detail'] as const;

/**
 * Key of one page of an upload feature's properties.
 *
 * @param {SubmissionUploadKeyScope} scope The upload.
 * @param {number} submissionFeatureId The feature.
 * @param {ApiPaginationRequestOptions & { search?: string }} params The page and optional search sent.
 * @returns The feature properties key.
 */
const featureProperties = (
  scope: SubmissionUploadKeyScope,
  submissionFeatureId: number,
  params: ApiPaginationRequestOptions & { search?: string }
) => [...feature(scope, submissionFeatureId), 'properties', params] as const;

/**
 * Key of an upload feature's geometry extent.
 *
 * @param {SubmissionUploadKeyScope} scope The upload.
 * @param {number | null} submissionFeatureId The feature, or null where no feature is selected and the
 * query is skipped.
 * @returns The geometry extent key.
 */
const featureGeometryExtent = (scope: SubmissionUploadKeyScope, submissionFeatureId: number | null) =>
  [...feature(scope, submissionFeatureId), 'geometry-extent'] as const;

/**
 * Query keys for submission uploads and their reviews, ordered from broad to narrow so that each prefix
 * names the set of queries a change invalidates.
 */
export const submissionUploadQueryKeys = {
  upload,
  review,
  reviewDetail,
  securityRules,
  selectedFeatureRules,
  featureRulesAll,
  featureRules,
  featureSearch,
  featureSearchCount,
  featureSearchResultsAll,
  featureSearchResults,
  feature,
  featureDetail,
  featureProperties,
  featureGeometryExtent
};
