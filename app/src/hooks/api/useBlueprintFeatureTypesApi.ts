import { AxiosInstance } from 'axios';
import {
  IGetBlueprintFeatureTypesParams,
  IBlueprintFeatureType,
  IBlueprintFeatureTypesResponse,
  ICreateBlueprintFeatureType
} from 'interfaces/useBlueprintFeatureTypesApi.interface';

/**
 * Resource operations for BlueprintFeatureType records.
 *
 * @param axios Authenticated HTTP client.
 * @returns Explicit membership operations.
 */
export const useBlueprintFeatureTypesApi = (axios: AxiosInstance) => {
  /**
   * List non-deleted feature-type memberships in the selected blueprint.
   *
   * @param blueprintId Owning blueprint.
   * @param params Search, active-membership filtering, pagination, and sorting.
   * @returns Matching feature-type memberships and pagination metadata.
   */
  const getBlueprintFeatureTypes = async (
    blueprintId: number,
    params?: IGetBlueprintFeatureTypesParams
  ): Promise<IBlueprintFeatureTypesResponse> => {
    const { data } = await axios.get(`/api/administrative/blueprints/${blueprintId}/types`, {
      params
    });
    return data;
  };

  /**
   * Read an assignment within its blueprint.
   *
   * @param blueprintId Owning blueprint.
   * @param blueprintFeatureTypeId Assignment identifier.
   * @returns Confirmed assignment metadata.
   */
  const getBlueprintFeatureType = async (
    blueprintId: number,
    blueprintFeatureTypeId: number
  ): Promise<IBlueprintFeatureType> => {
    const { data } = await axios.get(`/api/administrative/blueprints/${blueprintId}/types/${blueprintFeatureTypeId}`);
    return data;
  };

  /**
   * Assign a reusable global feature type to the selected blueprint.
   *
   * @param blueprintId Owning blueprint.
   * @param payload Assignment fields.
   * @returns Blueprint feature-type membership metadata.
   */
  const createBlueprintFeatureType = async (
    blueprintId: number,
    payload: ICreateBlueprintFeatureType
  ): Promise<IBlueprintFeatureType> => {
    const { data } = await axios.post(`/api/administrative/blueprints/${blueprintId}/types`, payload);
    return data;
  };

  /**
   * Delete a feature-type membership and its active property assignments without deleting history.
   *
   * @param blueprintId Owning blueprint.
   * @param blueprintFeatureTypeId Membership identifier.
   * @returns Blueprint feature-type membership metadata.
   */
  const deleteBlueprintFeatureType = async (
    blueprintId: number,
    blueprintFeatureTypeId: number
  ): Promise<IBlueprintFeatureType> => {
    const { data } = await axios.delete(
      `/api/administrative/blueprints/${blueprintId}/types/${blueprintFeatureTypeId}`
    );
    return data;
  };

  return {
    getBlueprintFeatureTypes,
    getBlueprintFeatureType,
    createBlueprintFeatureType,
    deleteBlueprintFeatureType
  };
};
