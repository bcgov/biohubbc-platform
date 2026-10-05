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
   *
   * @param blueprintId Blueprint identifier.
   * @returns Blueprint metadata, including retired records.
   */
  const getBlueprint = async (blueprintId: number): Promise<IBlueprint> => {
    const { data } = await axios.get(`/api/administrative/blueprints/${blueprintId}`);
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
   *
   * @param blueprintId Resource identifier.
   * @param payload Mutable metadata.
   * @returns Confirmed resource.
   */
  const updateBlueprint = async (blueprintId: number, payload: IUpdateBlueprint): Promise<IBlueprint> => {
    const { data } = await axios.put(`/api/administrative/blueprints/${blueprintId}`, payload);
    return data;
  };

  /**
   * Retire a resource using existing lifecycle semantics.
   *
   * @param blueprintId Resource identifier.
   * @returns Server confirmation.
   */
  const retireBlueprint = async (blueprintId: number): Promise<IBlueprint> => {
    const { data } = await axios.delete(`/api/administrative/blueprints/${blueprintId}`);
    return data;
  };

  /**
   * Select an effective blueprint as the default.
   *
   * @param blueprintId Blueprint identifier.
   * @returns Confirmed default metadata.
   */
  const setDefaultBlueprint = async (blueprintId: number): Promise<IBlueprint> => {
    const { data } = await axios.put(`/api/administrative/blueprints/${blueprintId}/default`);
    return data;
  };
  /**
   * Publish a draft using the database clock without changing the default blueprint.
   *
   * @param blueprintId Blueprint identifier.
   * @returns Confirmed published metadata.
   */
  const publishBlueprint = async (blueprintId: number): Promise<IBlueprint> => {
    const { data } = await axios.post(`/api/administrative/blueprints/${blueprintId}/publish`);
    return data;
  };

  return {
    getBlueprints,
    getBlueprint,
    createBlueprint,
    updateBlueprint,
    retireBlueprint,
    setDefaultBlueprint,
    publishBlueprint
  };
};
