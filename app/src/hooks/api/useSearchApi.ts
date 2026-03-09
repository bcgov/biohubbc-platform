import { AxiosInstance } from 'axios';
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
   * @param {ISearchFeaturesFilters} filters - Search parameters
   * @param {ApiPaginationRequestOptions} pagination
   * @return {Promise<SearchFeatureResponse >} Array of matching features sorted by relevancy
   */
  const searchFeatures = async (
    filters: ISearchFeaturesFilters,
    pagination?: ApiPaginationRequestOptions
  ): Promise<SearchFeatureResponse> => {
    const body = { filters, pagination };
    const { data } = await axios.post<SearchFeatureResponse>('/api/search/feature', body);

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
