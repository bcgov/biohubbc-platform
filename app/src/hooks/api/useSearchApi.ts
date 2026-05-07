import { AxiosInstance } from 'axios';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import {
  CreateDownloadResponse,
  ISearchAllFilters,
  ISearchFeaturesFilters,
  ISearchPropertyFilters,
  SearchFeatureResponse,
  SearchPropertyResponse,
  SearchResponse,
  SearchSummaryResponse
} from 'interfaces/useSearchApi.interface';
import qs from 'qs';
import { ApiPaginationRequestOptions } from 'types/pagination';

// `createDownload` and `CreateDownloadResponse` here are the legacy filter-based variant kept
// alive only for the anonymous Bulk Download branch on `SearchResultPage`. The authenticated
// flow uses `useDownloadApi.createDownload`. The anonymous branch is broken end-to-end against
// the merged backend; both will be removed when the anonymous flow is reconciled.

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
   * @param {ExpressionTreeExpression} expressionTree - Optional expression tree search parameters
   * @param {ApiPaginationRequestOptions} pagination
   * @return {Promise<SearchFeatureResponse >} Array of matching features sorted by relevancy
   */
  const searchFeatures = async (
    featureType: string,
    expressionTree?: ExpressionTreeExpression | null,
    pagination?: ApiPaginationRequestOptions
  ): Promise<SearchFeatureResponse> => {
    const body = expressionTree ? { expression: expressionTree, pagination } : { pagination };
    const { data } = await axios.post<SearchFeatureResponse>(`/api/search/feature/${featureType}`, body);

    return data;
  };

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

  /**
   * Create a download from search filters.
   * Bypasses the shopping cart — sends current search filters to the server which resolves
   * them to feature IDs and creates a download record. The download UUID is the access
   * credential for anonymous users; authenticated users get it linked to their account.
   */
  const createDownload = async (filters: ISearchFeaturesFilters): Promise<CreateDownloadResponse> => {
    const { data } = await axios.post<CreateDownloadResponse>('/api/download', { filters });
    return data;
  };

  return {
    searchFeatures,
    searchAll,
    searchProperties,
    searchSummary,
    createDownload
  };
};
