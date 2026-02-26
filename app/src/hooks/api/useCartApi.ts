import { AxiosInstance } from 'axios';
import {
  CartFeatureListResponse,
  CartWithFeaturesResponse,
  CheckoutCartResponse
} from 'interfaces/useCartApi.interface';
import qs from 'qs';
import { ApiPaginationRequestOptions } from 'types/pagination';

/**
 * Returns API methods for cart management.
 *
 * @param {AxiosInstance} axios
 * @return {*} object whose properties are supported api methods.
 */
export const useCartApi = (axios: AxiosInstance) => {
  /**
   * Create a new cart.
   *
   * @param {object} cartData - Data used to create the cart.
   * @return {Promise<CartWithFeaturesResponse>} The newly created cart.
   */
  const createCart = async (cartData: object): Promise<CartWithFeaturesResponse> => {
    const { data } = await axios.post<CartWithFeaturesResponse>('/api/cart', cartData);

    return data;
  };

  /**
   * Retrieve cart details by cart ID.
   *
   * @param {string} cartId - The cart ID to fetch details for.
   * @param {ApiPaginationRequestOptions} pagination - Optional pagination parameters for the features.
   * @return {Promise<CartWithFeaturesResponse>} Cart metadata with feature list and pagination.
   */
  const getCartById = async (
    cartId: string,
    pagination?: ApiPaginationRequestOptions
  ): Promise<CartWithFeaturesResponse> => {
    const { data } = await axios.get<CartWithFeaturesResponse>(`/api/cart/${cartId}`, {
      params: pagination,
      paramsSerializer: (params) => qs.stringify(params)
    });

    return data;
  };

  /**
   * Assign a cart to the currently authenticated user.
   *
   * @param {string} cartId - The cart ID to assign.
   * @return {Promise<void>}
   */
  const assignCartToCurrentUser = async (cartId: string): Promise<void> => {
    await axios.put(`/api/cart/${cartId}`);
  };

  /**
   * Add features to the cart.
   *
   * @param {string} cartId - The cart ID to which features are added.
   * @param {object} featuresData - Data containing the features to be added to the cart.
   * @param {ApiPaginationRequestOptions} pagination - Optional pagination parameters for returned features.
   * @return {Promise<CartFeatureListResponse>} Updated cart features with pagination.
   */
  const addCartFeatures = async (
    cartId: string,
    featuresData: object,
    pagination?: ApiPaginationRequestOptions
  ): Promise<CartFeatureListResponse> => {
    const { data } = await axios.post<CartFeatureListResponse>(`/api/cart/${cartId}/feature`, featuresData, {
      params: pagination,
      paramsSerializer: (params) => qs.stringify(params)
    });

    return data;
  };

  /**
   * Remove a specific feature from the cart by its feature ID.
   *
   * @param {string} cartId - The cart ID containing the feature to be removed.
   * @param {string} cartSubmissionFeatureId - The ID of the feature to remove.
   * @param {ApiPaginationRequestOptions} pagination - Optional pagination parameters for returned features.
   * @return {Promise<CartFeatureListResponse>} Updated cart features with pagination.
   */
  const removeCartFeatureById = async (
    cartId: string,
    cartSubmissionFeatureId: string,
    pagination?: ApiPaginationRequestOptions
  ): Promise<CartFeatureListResponse> => {
    const { data } = await axios.delete<CartFeatureListResponse>(
      `/api/cart/${cartId}/feature/${cartSubmissionFeatureId}`,
      {
        params: pagination,
        paramsSerializer: (params) => qs.stringify(params)
      }
    );

    return data;
  };

  /**
   * Clear all features from the cart.
   *
   * @param {string} cartId - The cart ID to clear.
   * @param {ApiPaginationRequestOptions} pagination - Optional pagination parameters for returned features.
   * @return {Promise<CartFeatureListResponse>} Updated cart features with pagination.
   */
  const clearCart = async (
    cartId: string,
    pagination?: ApiPaginationRequestOptions
  ): Promise<CartFeatureListResponse> => {
    const { data } = await axios.delete<CartFeatureListResponse>(`/api/cart/${cartId}/feature`, {
      params: pagination,
      paramsSerializer: (params) => qs.stringify(params)
    });

    return data;
  };

  /**
   * Check out a cart, creating a download from all cart features.
   *
   * @param {string} cartId - The cart to check out.
   * @return {Promise<CheckoutCartResponse>} The created download ID.
   */
  const checkoutCart = async (cartId: string): Promise<CheckoutCartResponse> => {
    const { data } = await axios.post<CheckoutCartResponse>(`/api/cart/${cartId}/checkout`);

    return data;
  };

  return {
    createCart,
    assignCartToCurrentUser,
    getCartById,
    addCartFeatures,
    removeCartFeatureById,
    clearCart,
    checkoutCart
  };
};
