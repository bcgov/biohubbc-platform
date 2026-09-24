import { AxiosInstance } from 'axios';
import {
  IGetBlueprintFeatureTypePropertiesParams,
  IBlueprintFeatureTypeProperty,
  IBlueprintFeatureTypePropertiesResponse,
  ICreateBlueprintFeatureTypeProperty,
  IUpdateBlueprintFeatureTypeProperty
} from 'interfaces/useBlueprintFeatureTypePropertiesApi.interface';

/**
 * Resource operations for BlueprintFeatureTypeProperty records.
 *
 * @param axios Authenticated HTTP client.
 * @returns Explicit membership operations.
 */
export const useBlueprintFeatureTypePropertiesApi = (axios: AxiosInstance) => {
  /**
   * List non-deleted property memberships across the blueprint or within a selected feature-type assignment.
   *
   * @param blueprintId Owning blueprint.
   * @param params Search, pagination, and sorting.
   * @returns Matching property memberships and pagination metadata.
   */
  const getBlueprintFeatureTypeProperties = async (
    blueprintId: number,
    params?: IGetBlueprintFeatureTypePropertiesParams
  ): Promise<IBlueprintFeatureTypePropertiesResponse> => {
    const { data } = await axios.get(`/api/administrative/blueprints/${blueprintId}/properties`, {
      params
    });
    return data;
  };

  /**
   * Assign a reusable global property to a specific blueprint feature-type membership.
   *
   * @param blueprintId Owning blueprint.
   * @param payload Assignment fields.
   * @returns Blueprint property membership metadata.
   */
  const createBlueprintFeatureTypeProperty = async (
    blueprintId: number,
    payload: ICreateBlueprintFeatureTypeProperty
  ): Promise<IBlueprintFeatureTypeProperty> => {
    const { data } = await axios.post(`/api/administrative/blueprints/${blueprintId}/properties`, payload);
    return data;
  };

  /**
   * Update requiredness and multiplicity without changing property membership identity.
   *
   * @param blueprintId Owning blueprint.
   * @param blueprintFeatureTypePropertyId Membership identifier.
   * @param payload Assignment fields.
   * @returns Blueprint property membership metadata.
   */
  const updateBlueprintFeatureTypeProperty = async (
    blueprintId: number,
    blueprintFeatureTypePropertyId: number,
    payload: IUpdateBlueprintFeatureTypeProperty
  ): Promise<IBlueprintFeatureTypeProperty> => {
    const { data } = await axios.put(
      `/api/administrative/blueprints/${blueprintId}/properties/${blueprintFeatureTypePropertyId}`,
      payload
    );
    return data;
  };

  /**
   * Delete a blueprint property membership while preserving historical references.
   *
   * @param blueprintId Owning blueprint.
   * @param blueprintFeatureTypePropertyId Membership identifier.
   * @returns Blueprint property membership metadata.
   */
  const deleteBlueprintFeatureTypeProperty = async (
    blueprintId: number,
    blueprintFeatureTypePropertyId: number
  ): Promise<IBlueprintFeatureTypeProperty> => {
    const { data } = await axios.delete(
      `/api/administrative/blueprints/${blueprintId}/properties/${blueprintFeatureTypePropertyId}`
    );
    return data;
  };

  return {
    getBlueprintFeatureTypeProperties,
    createBlueprintFeatureTypeProperty,
    updateBlueprintFeatureTypeProperty,
    deleteBlueprintFeatureTypeProperty
  };
};
