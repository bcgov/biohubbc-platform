import { AxiosInstance } from 'axios';
import {
  IFeatureProperty,
  IFeaturePropertiesResponse,
  ICreateFeatureProperty,
  IUpdateFeatureProperty,
  IFeaturePropertyType
} from 'interfaces/useFeaturePropertiesApi.interface';
import { ApiPaginationRequestOptions, ApiSearchParams } from 'types/pagination';

/**
 * Administrative feature-properties API operations.
 * @param axios Authenticated HTTP client.
 * @returns Explicit resource operations.
 */
export const useFeaturePropertiesApi = (axios: AxiosInstance) => {
  /**
   * Retrieve a filtered administrative page.
   * @param filters Search filters.
   * @param pagination Server pagination.
   * @returns Metadata and filtered count.
   */
  const getFeatureProperties = async (
    filters: ApiSearchParams,
    pagination: ApiPaginationRequestOptions
  ): Promise<IFeaturePropertiesResponse> => {
    const { data } = await axios.get('/api/administrative/feature-properties', {
      params: { ...filters, ...pagination }
    });
    return data;
  };

  /**
   * Create resource metadata.
   * @param payload Creation fields.
   * @returns Confirmed resource.
   */
  const createFeatureProperty = async (payload: ICreateFeatureProperty): Promise<IFeatureProperty> => {
    const { data } = await axios.post('/api/administrative/feature-properties', payload);
    return data;
  };

  /**
   * Update supplied resource metadata.
   * @param id Resource identifier.
   * @param payload Mutable metadata.
   * @returns Confirmed resource.
   */
  const updateFeatureProperty = async (id: number, payload: IUpdateFeatureProperty): Promise<IFeatureProperty> => {
    const { data } = await axios.put(`/api/administrative/feature-properties/${id}`, payload);
    return data;
  };

  /**
   * Delete a resource using existing lifecycle semantics.
   * @param id Resource identifier.
   * @returns Server confirmation.
   */
  const deleteFeatureProperty = async (id: number): Promise<{ message: string }> => {
    const { data } = await axios.delete(`/api/administrative/feature-properties/${id}`);
    return data;
  };

  /**
   * Retrieve the small property-type selector lookup.
   * @returns Available identifiers and names.
   */
  const getFeaturePropertyTypes = async (): Promise<{ feature_property_types: IFeaturePropertyType[] }> => {
    const { data } = await axios.get('/api/administrative/feature-property-types');
    return data;
  };
  return {
    getFeatureProperties,
    createFeatureProperty,
    updateFeatureProperty,
    deleteFeatureProperty,
    getFeaturePropertyTypes
  };
};
