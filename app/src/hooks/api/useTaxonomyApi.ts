import { AxiosInstance } from 'axios';
import { ITaxonomyListResponse, ITaxonomySearchResponse } from 'interfaces/useTaxonomyApi.interface';
import qs from 'qs';
import { ApiPaginationRequestOptions } from 'types/pagination';

/**
 * Returns API methods for searching taxonomy (species).
 *
 * @param {AxiosInstance} axios
 */
export const useTaxonomyApi = (axios: AxiosInstance) => {
  /**
   * Search for species by name/keywords with optional pagination.
   *
   * @param {string} searchTerm - Keyword(s) to search species
   * @param {ApiPaginationRequestOptions} pagination
   * @returns {Promise<ITaxonomySearchResponse>}
   */
  const searchSpecies = async (
    searchTerm: string,
    pagination?: ApiPaginationRequestOptions
  ): Promise<ITaxonomySearchResponse> => {
    const params = { terms: searchTerm, ...pagination };

    const { data } = await axios.get<ITaxonomySearchResponse>('/api/taxonomy/taxon', {
      params,
      paramsSerializer: (p) => qs.stringify(p)
    });

    return data;
  };

  /**
   * Fetch species by their IDs
   *
   * @param {number[]} tsns - Array of species TSNs
   * @returns {Promise<ITaxonomyListResponse>}
   */
  const getSpeciesFromIds = async (tsns: number[]): Promise<ITaxonomyListResponse> => {
    const params = { tsn: tsns };
    const { data } = await axios.get<ITaxonomyListResponse>('/api/taxonomy/taxon/tsn', {
      params,
      paramsSerializer: (p) => qs.stringify(p)
    });

    return data;
  };

  return {
    searchSpecies,
    getSpeciesFromIds
  };
};

export default useTaxonomyApi;
