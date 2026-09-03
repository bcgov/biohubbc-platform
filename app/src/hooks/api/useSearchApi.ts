import { AxiosInstance, type AxiosRequestConfig } from 'axios';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import {
  ISearchAllFilters,
  ISearchPropertyFilters,
  ISearchTaxonFilters,
  SearchFeatureCountResponse,
  SearchFeatureResponse,
  SearchPropertyResponse,
  SearchResponse,
  SearchSummaryResponse,
  SearchTaxonResponse
} from 'interfaces/useSearchApi.interface';
import qs from 'qs';
import { useCallback } from 'react';
import { ApiCursorPaginationRequestOptions, ApiPaginationRequestOptions } from 'types/pagination';

/**
 * Returns API methods for searching features.
 *
 * @param {AxiosInstance} axios
 * @return {*} object whose properties are supported api methods.
 */
export const useSearchApi = (axios: AxiosInstance) => {
  /**
   * Search for features of a feature type by expression tree.
   *
   * @param {string} featureType - Feature type to search.
   * @param {ExpressionTreeExpression | null} [expressionTree] - Optional expression tree search parameters
   * @param {ApiCursorPaginationRequestOptions} [pagination] - Cursor, limit, and sort options.
   * @param {Pick<AxiosRequestConfig, 'signal'>} [options] - Optional cancellation signal.
   * @returns {Promise<SearchFeatureResponse>} Matching features, property metadata, and adjacent-page cursors.
   */
  const searchFeatures = useCallback(
    async (
      featureType: string,
      expressionTree?: ExpressionTreeExpression | null,
      pagination?: ApiCursorPaginationRequestOptions,
      options?: Pick<AxiosRequestConfig, 'signal'>
    ): Promise<SearchFeatureResponse> => {
      const body = expressionTree ? { expression: expressionTree, pagination } : { pagination };
      const { data } = await axios.post<SearchFeatureResponse>(`/api/search/feature/${featureType}`, body, {
        signal: options?.signal
      });

      return data;
    },
    [axios]
  );

  /**
   * Count the features matching an optional expression tree.
   *
   * @param {string} featureType - Feature type route segment.
   * @param {ExpressionTreeExpression | null} expressionTree - Expression tree search parameters, or null for all features.
   * @param {{ signal: AbortSignal }} options - Request cancellation signal.
   * @returns {Promise<SearchFeatureCountResponse>} Matching feature count.
   */
  const countFeatures = useCallback(
    async (
      featureType: string,
      expressionTree: ExpressionTreeExpression | null,
      options: { signal: AbortSignal }
    ): Promise<SearchFeatureCountResponse> => {
      const body = expressionTree ? { expression: expressionTree } : {};
      const { data } = await axios.post<SearchFeatureCountResponse>(`/api/search/feature/${featureType}/count`, body, {
        signal: options.signal
      });

      return data;
    },
    [axios]
  );

  /**
   * Search for properties by keywords and/or property filters.
   *
   * @param {ISearchPropertyFilters} filters - Search parameters
   * @param {ApiPaginationRequestOptions} pagination
   * @return {Promise<SearchPropertyResponse >} Array of matching properties sorted by relevancy
   */
  const searchProperties = async (
    filters: ISearchPropertyFilters,
    pagination?: ApiPaginationRequestOptions
  ): Promise<SearchPropertyResponse> => {
    const body = { filters, pagination };
    const { data } = await axios.post<SearchPropertyResponse>('/api/search/property', body);

    return data;
  };

  /**
   * Search local taxon records by filter.
   *
   * @param {ISearchTaxonFilters} filters - Search parameters
   * @param {ApiPaginationRequestOptions} pagination
   * @return {Promise<SearchTaxonResponse>} Matching local taxon records
   */
  const searchTaxon = async (
    filters: ISearchTaxonFilters,
    pagination?: ApiPaginationRequestOptions
  ): Promise<SearchTaxonResponse> => {
    const body = { filters, pagination };
    const { data } = await axios.post<SearchTaxonResponse>('/api/search/taxon', body);

    return data;
  };

  /**
   * Fetch all published features with optional search terms and pagination.
   *
   * @param {ISearchAllFilters} params
   * @param {ApiPaginationRequestOptions} pagination
   * @return {Promise<SearchResponse>}
   */
  const searchAll = async (
    params?: ISearchAllFilters,
    pagination?: ApiPaginationRequestOptions
  ): Promise<SearchResponse> => {
    const mergedParams = { ...params, ...pagination };

    const { data } = await axios.get<SearchResponse>('api/search', {
      params: mergedParams,
      paramsSerializer: (params) => qs.stringify(params)
    });

    return data;
  };

  /**
   * Fetch summary counts for features, submissions, and taxonomy based on search terms.
   *
   * @param {ISearchAllFilters} params
   * @returns {Promise<SearchSummaryResponse>} - Returns counts of matching features, submissions, and taxonomy.
   */
  const searchSummary = async (params?: ISearchAllFilters): Promise<SearchSummaryResponse> => {
    const { data } = await axios.get<SearchSummaryResponse>('api/search/summary', {
      params,
      paramsSerializer: (params) => qs.stringify(params)
    });

    return data;
  };

  return {
    searchFeatures,
    countFeatures,
    searchAll,
    searchProperties,
    searchTaxon,
    searchSummary
  };
};
