import { AxiosInstance } from 'axios';
import {
  ISearchFeaturesRequest,
  SearchFeatureResultWithRelevance,
  SearchFeaturesParams,
  SearchResponse,
  SearchSummaryResponse
} from 'interfaces/useSearchApi.interface';
import qs from 'qs';
import { ApiPaginationRequestOptions } from 'types/pagination';

/**
 * Returns API methods for searching features.
 *
 * @param {AxiosInstance} axios
 * @return {*} object whose properties are supported api methods.
 */
export const useSearchApi = (axios: AxiosInstance) => {
  /**
   * Search for features by keywords and/or property filters.
   *
   * @param {ISearchFeaturesRequest} params - Search parameters
   * @return {Promise<SearchFeatureResultWithRelevance[]>} Array of matching features sorted by relevancy
   */
  const searchFeatures = async (params: ISearchFeaturesRequest): Promise<SearchFeatureResultWithRelevance[]> => {
    const { data } = await axios.post<SearchFeatureResultWithRelevance[]>('/api/search/feature', params);

    return data;
  };

  /**
   * Fetch all published features with optional search terms and pagination.
   *
   * @param {SearchFeaturesParams} params
   * @param {ApiPaginationRequestOptions} pagination
   * @return {Promise<SearchResponse>}
   */
  const searchAll = async (
    params?: SearchFeaturesParams,
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
   * @param {SearchFeaturesParams} params
   * @returns {Promise<SearchSummaryResponse>} - Returns counts of matching features, submissions, and taxonomy.
   */
  const searchSummary = async (params?: SearchFeaturesParams): Promise<SearchSummaryResponse> => {
    const { data } = await axios.get<SearchSummaryResponse>('api/search/summary', {
      params,
      paramsSerializer: (params) => qs.stringify(params)
    });

    return data;
  };

  return {
    searchFeatures,
    searchAll,
    searchSummary
  };
};
