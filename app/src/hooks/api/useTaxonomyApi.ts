import { AxiosInstance } from 'axios';
import { ITaxonomyListResponse, ITaxonomySearchResponse } from 'interfaces/useTaxonomyApi.interface';
import qs from 'qs';

const useTaxonomyApi = (axios: AxiosInstance) => {
  const searchSpecies = async (value: string): Promise<ITaxonomySearchResponse> => {
    axios.defaults.params = { terms: value };

    const { data } = await axios.get(`/api/taxonomy/species/search`);

    return data;
  };

  const getSpeciesFromIds = async (value: number[]): Promise<ITaxonomyListResponse> => {
    axios.defaults.params = { ids: qs.stringify(value) };

    const { data } = await axios.get(`/api/taxonomy/species/list`);

    return data;
  };

  return {
    searchSpecies,
    getSpeciesFromIds
  };
};

export default useTaxonomyApi;
