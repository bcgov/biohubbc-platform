import { QUERY_KEY_ROOT } from 'constants/query-keys';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { ApiCursorPaginationRequestOptions, ApiPaginationRequestOptions } from 'types/pagination';

/**
 * Key prefix of every feature search: counts and results for any feature type, submissions and expression.
 *
 * @returns The feature searches key prefix.
 */
const features = () => [QUERY_KEY_ROOT.SEARCH, 'feature'] as const;

/**
 * Key prefix of a feature search's count and every page of its results: one feature type, optionally limited to
 * some submissions.
 *
 * @param {string} featureTypeName The feature type searched.
 * @param {number[] | undefined} submissionIds The submissions searched, or undefined for every submission.
 * @returns The feature search key prefix.
 */
const featureScope = (featureTypeName: string, submissionIds: number[] | undefined) =>
  [...features(), featureTypeName, { submissionIds: submissionIds ?? null }] as const;

/**
 * Key of the number of features matching an applied expression.
 *
 * @param {string} featureTypeName The feature type searched.
 * @param {number[] | undefined} submissionIds The submissions searched, or undefined for every submission.
 * @param {ExpressionTreeExpression | null} expression The applied expression, or null for every feature.
 * @returns The feature count key.
 */
const featureCount = (
  featureTypeName: string,
  submissionIds: number[] | undefined,
  expression: ExpressionTreeExpression | null
) => [...featureScope(featureTypeName, submissionIds), 'count', { expression }] as const;

/**
 * Key of one page of features matching an applied expression.
 *
 * @param {string} featureTypeName The feature type searched.
 * @param {number[] | undefined} submissionIds The submissions searched, or undefined for every submission.
 * @param {ExpressionTreeExpression | null} expression The applied expression, or null for every feature.
 * @param {ApiCursorPaginationRequestOptions} pagination The cursor page and sort.
 * @returns The feature results key.
 */
const featureResults = (
  featureTypeName: string,
  submissionIds: number[] | undefined,
  expression: ExpressionTreeExpression | null,
  pagination: ApiCursorPaginationRequestOptions
) => [...featureScope(featureTypeName, submissionIds), 'results', { expression, pagination }] as const;

/**
 * Key of one page of records matching a keyword across every kind of record.
 *
 * @param {string} keyword The keyword searched.
 * @param {ApiPaginationRequestOptions} pagination The page.
 * @returns The keyword records key.
 */
const keywordRecords = (keyword: string, pagination: ApiPaginationRequestOptions) =>
  [QUERY_KEY_ROOT.SEARCH, 'keyword', keyword, 'records', { pagination }] as const;

/**
 * Key of the counts of features, submissions and taxa matching a keyword.
 *
 * @param {string} keyword The keyword searched; empty matches everything.
 * @returns The keyword summary key.
 */
const keywordSummary = (keyword: string) => [QUERY_KEY_ROOT.SEARCH, 'keyword', keyword, 'summary'] as const;

/**
 * Key of the property options offered by expression-builder pickers for a keyword.
 *
 * With no keyword the options are hydrated with every property the draft expression already uses, so the draft's
 * property keys are part of the key; with a keyword they play no part.
 *
 * @param {string} keyword The trimmed picker keyword, or empty for the default options.
 * @param {string[]} hydratedPropertyKeys Sorted property keys the options must include; empty with a keyword.
 * @returns The property options key.
 */
const propertyOptions = (keyword: string, hydratedPropertyKeys: string[]) =>
  [QUERY_KEY_ROOT.SEARCH, 'property', 'options', { keyword, hydratedPropertyKeys }] as const;

/**
 * Key of the properties recommended for the expression builder's search text.
 *
 * @param {string} keyword The trimmed search text.
 * @returns The recommended properties key.
 */
const recommendedProperties = (keyword: string) =>
  [QUERY_KEY_ROOT.SEARCH, 'property', 'recommended', { keyword }] as const;

/**
 * Key of the property that species predicates are written against.
 *
 * @returns The species predicate property key.
 */
const speciesPredicateProperty = () => [QUERY_KEY_ROOT.SEARCH, 'property', 'species-predicate'] as const;

/**
 * Key of the species recommended for the expression builder's search text.
 *
 * @param {string} keyword The trimmed search text.
 * @returns The recommended species key.
 */
const recommendedSpecies = (keyword: string) => [QUERY_KEY_ROOT.SEARCH, 'species', 'recommended', { keyword }] as const;

/**
 * Key of the local taxa matching a taxon value typed into a predicate.
 *
 * @param {string} keyword The trimmed text typed.
 * @returns The taxon options key.
 */
const taxonOptions = (keyword: string) => [QUERY_KEY_ROOT.SEARCH, 'taxon', 'options', { keyword }] as const;

/**
 * Query keys for search, ordered from broad to narrow so that each prefix names the set of queries a change
 * invalidates.
 */
export const searchQueryKeys = {
  features,
  featureScope,
  featureCount,
  featureResults,
  keywordRecords,
  keywordSummary,
  propertyOptions,
  recommendedProperties,
  speciesPredicateProperty,
  recommendedSpecies,
  taxonOptions
};
