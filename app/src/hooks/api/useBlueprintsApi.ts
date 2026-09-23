import { AxiosInstance } from 'axios';
import {
  IBlueprint,
  IBlueprintsResponse,
  ICreateBlueprint,
  IUpdateBlueprint,
  IBlueprintFilters
} from 'interfaces/useBlueprintsApi.interface';
import { ApiPaginationRequestOptions } from 'types/pagination';

/**
 * Administrative blueprints API operations.
 * @param axios Authenticated HTTP client.
 * @returns Explicit resource operations.
 */
export const useBlueprintsApi = (axios: AxiosInstance) => {
  /**
   * Retrieve a filtered administrative page.
   * @param filters Search filters.
   * @param pagination Server pagination.
   * @returns Metadata and filtered count.
   */
  const getBlueprints = async (
    filters: IBlueprintFilters,
    pagination: ApiPaginationRequestOptions
  ): Promise<IBlueprintsResponse> => {
    const { data } = await axios.get('/api/administrative/blueprints', { params: { ...filters, ...pagination } });
    return data;
  };

  /**
   * Resolve a selected parent independently of the current search page.
   * @param id Blueprint identifier.
   * @returns Blueprint metadata, including retired records.
   */
  const getBlueprint = async (id: number): Promise<IBlueprint> => {
    const { data } = await axios.get(`/api/administrative/blueprints/${id}`);
    return data;
  };

  /**
   * Create resource metadata.
   * @param payload Creation fields.
   * @returns Confirmed resource.
   */
  const createBlueprint = async (payload: ICreateBlueprint): Promise<IBlueprint> => {
    const { data } = await axios.post('/api/administrative/blueprints', payload);
    return data;
  };

  /**
   * Update supplied resource metadata.
   * @param id Resource identifier.
   * @param payload Mutable metadata.
   * @returns Confirmed resource.
   */
  const updateBlueprint = async (id: number, payload: IUpdateBlueprint): Promise<IBlueprint> => {
    const { data } = await axios.put(`/api/administrative/blueprints/${id}`, payload);
    return data;
  };

  /**
   * Retire a resource using existing lifecycle semantics.
   * @param id Resource identifier.
   * @returns Server confirmation.
   */
  const retireBlueprint = async (id: number): Promise<IBlueprint> => {
    const { data } = await axios.delete(`/api/administrative/blueprints/${id}`);
    return data;
  };

  /**
   * Select an effective blueprint as the default.
   * @param id Blueprint identifier.
   * @returns Confirmed default metadata.
   */
  const setDefaultBlueprint = async (id: number): Promise<IBlueprint> => {
    const { data } = await axios.put(`/api/administrative/blueprints/${id}/default`);
    return data;
  };
  return { getBlueprints, getBlueprint, createBlueprint, updateBlueprint, retireBlueprint, setDefaultBlueprint };
};
