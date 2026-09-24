import { IAvailableFeatureTypesResponse } from 'interfaces/useFeatureTypesApi.interface';
import { AxiosInstance } from 'axios';
import {
  IGetAvailableFeatureTypesForBlueprintParams,
  IFeatureType,
  IFeatureTypesResponse,
  ICreateFeatureType,
  IUpdateFeatureType
} from 'interfaces/useFeatureTypesApi.interface';
import { ApiPaginationRequestOptions, ApiSearchParams } from 'types/pagination';

/**
 * Administrative feature-types API operations.
 * @param axios Authenticated HTTP client.
 * @returns Explicit resource operations.
 */
export const useFeatureTypesApi = (axios: AxiosInstance) => {
  /**
   * Retrieve a filtered administrative page.
   * @param filters Search filters.
   * @param pagination Server pagination.
   * @returns Metadata and filtered count.
   */
  const getFeatureTypes = async (
    filters: ApiSearchParams,
    pagination: ApiPaginationRequestOptions
  ): Promise<IFeatureTypesResponse> => {
    const { data } = await axios.get('/api/administrative/feature-types', { params: { ...filters, ...pagination } });
    return data;
  };

  /**
   * Create resource metadata.
   * @param payload Creation fields.
   * @returns Confirmed resource.
   */
  const createFeatureType = async (payload: ICreateFeatureType): Promise<IFeatureType> => {
    const { data } = await axios.post('/api/administrative/feature-types', payload);
    return data;
  };

  /**
   * Update supplied resource metadata.
   * @param id Resource identifier.
   * @param payload Mutable metadata.
   * @returns Confirmed resource.
   */
  const updateFeatureType = async (id: number, payload: IUpdateFeatureType): Promise<IFeatureType> => {
    const { data } = await axios.put(`/api/administrative/feature-types/${id}`, payload);
    return data;
  };

  /**
   * Delete a resource using existing lifecycle semantics.
   * @param id Resource identifier.
   * @returns Server confirmation.
   */
  const deleteFeatureType = async (id: number): Promise<{ message: string }> => {
    const { data } = await axios.delete(`/api/administrative/feature-types/${id}`);
    return data;
  };
  /**
   * Search definitions eligible for the selected membership scope.
   *
   * @param blueprintId Owning blueprint.
   * @param params Search, pagination, and sorting.
   * @returns Paginated eligible options.
   */
  const getAvailableFeatureTypesForBlueprint = async (
    blueprintId: number,
    params?: IGetAvailableFeatureTypesForBlueprintParams
  ): Promise<IAvailableFeatureTypesResponse> => {
    const { data } = await axios.get(`/api/administrative/blueprints/${blueprintId}/types/available`, {
      params
    });
    return data;
  };

  return {
    getAvailableFeatureTypesForBlueprint,
    getFeatureTypes,
    createFeatureType,
    updateFeatureType,
    deleteFeatureType
  };
};
