import { IDBConnection } from '../database/db';
import { CartFeatureListResponse, CartSubmissionFeature } from '../models/cart';
import { CartSubmissionFeatureRepository } from '../repositories/cart-submission-feature-repository';
import { makePaginationResponse } from '../utils/pagination';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { PolicyService } from './access-policy/policy-service';
import { DBService } from './db-service';

/**
 * Service for managing submission features associated with carts.
 */
export class CartSubmissionFeatureService extends DBService {
  policyService: PolicyService;
  cartSubmissionFeatureRepository: CartSubmissionFeatureRepository;

  /**
   * Initializes the CartSubmissionFeatureService with a database connection.
   *
   * @param {IDBConnection} connection - Database connection instance
   * @memberof CartSubmissionFeatureService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.policyService = new PolicyService(connection);
    this.cartSubmissionFeatureRepository = new CartSubmissionFeatureRepository(connection);
  }

  /**
   * Adds multiple submission features to a cart with auth-aware security gating.
   * Anonymous users can only add unsecured features. Authenticated users can also
   * add secured features they have scope access to.
   *
   * @param {string} cartId - The ID of the cart
   * @param {number[]} submissionFeatureIds - The list of submission feature IDs to add
   * @param {number | null} systemUserId - The authenticated user's ID, or null for anonymous
   * @return {Promise<void>}
   * @memberof CartSubmissionFeatureService
   */
  async createCartSubmissionFeatures(
    cartId: string,
    submissionFeatureIds: number[],
    systemUserId: number | null
  ): Promise<void> {
    if (submissionFeatureIds.length < 1) {
      return;
    }

    if (systemUserId === null) {
      await this.cartSubmissionFeatureRepository.createUnsecuredCartSubmissionFeatures(cartId, submissionFeatureIds);
    } else {
      await this.cartSubmissionFeatureRepository.createCartSubmissionFeaturesWithScopeCheck(
        cartId,
        submissionFeatureIds,
        systemUserId
      );
    }
  }

  /**
   * Removes submission features from a cart.
   *
   * @param {string} cartId - The ID of the cart
   * @param {string[]} cartSubmissionFeatureIds - The list of submission feature IDs to remove
   * @return {Promise<void>}
   * @memberof CartSubmissionFeatureService
   */
  async removeSubmissionFeaturesFromCart(cartId: string, cartSubmissionFeatureIds: string[]): Promise<void> {
    if (cartSubmissionFeatureIds.length < 1) {
      return;
    }

    await this.cartSubmissionFeatureRepository.removeSubmissionFeaturesFromCart(cartId, cartSubmissionFeatureIds);
  }

  /**
   * Clears all submission features from a cart.
   *
   * @param {string} cartId - The ID of the cart
   * @return {Promise<void>}
   * @memberof CartSubmissionFeatureService
   */
  async clearCart(cartId: string): Promise<void> {
    await this.cartSubmissionFeatureRepository.clearCart(cartId);
  }

  /**
   * Get all submission feature IDs in a cart (unpaginated).
   * Used by checkout to identify which features to link to the download record.
   *
   * @param {string} cartId - The ID of the cart
   * @return {Promise<number[]>}
   * @memberof CartSubmissionFeatureService
   */
  async getCartSubmissionFeatureIds(cartId: string): Promise<number[]> {
    return this.cartSubmissionFeatureRepository.getCartSubmissionFeatureIds(cartId);
  }

  /**
   * Get submission features in a cart, optionally filtered by submission feature ID and paginated.
   *
   * @param {string} cartId - The ID of the cart
   * @param {ApiPaginationOptions} [pagination] - Optional pagination options
   * @param {number} [submissionFeatureId] - Optional submission feature ID to filter by
   * @return {Promise<CartSubmissionFeature[]>}
   * @memberof CartSubmissionFeatureService
   */
  async getCartSubmissionFeatures(
    cartId: string,
    pagination?: ApiPaginationOptions,
    submissionFeatureId?: number
  ): Promise<CartSubmissionFeature[]> {
    return this.cartSubmissionFeatureRepository.getCartSubmissionFeatures(cartId, pagination, submissionFeatureId);
  }

  /**
   * Returns the total number of submission features in a cart.
   *
   * @param {string} cartId - The ID of the cart
   * @return {Promise<number>}
   * @memberof CartSubmissionFeatureService
   */
  async getCartSubmissionFeatureCount(cartId: string): Promise<number> {
    return this.cartSubmissionFeatureRepository.getCartSubmissionFeatureCount(cartId);
  }

  /**
   * Returns true if the given submission feature exists in an active cart.
   *
   * @param {string} cartId - The ID of the cart
   * @param {number} submissionFeatureId - The submission feature ID to check
   * @return {Promise<boolean>}
   * @memberof CartSubmissionFeatureService
   */
  async isSubmissionFeatureInCart(cartId: string, submissionFeatureId: number): Promise<boolean> {
    const ids = await this.cartSubmissionFeatureRepository.getCartSubmissionFeatureIds(cartId);
    return ids.includes(submissionFeatureId);
  }

  /**
   * Returns cart features and pagination payload in the same shape used by cart feature endpoints.
   *
   * @param {string} cartId - The ID of the cart
   * @param {ApiPaginationOptions} pagination - Requested pagination parameters
   * @return {Promise<CartFeatureListResponse>}
   * @memberof CartSubmissionFeatureService
   */
  async getPaginatedCartFeaturesResponse(
    cartId: string,
    pagination: ApiPaginationOptions,
    submissionFeatureId?: number
  ): Promise<CartFeatureListResponse> {
    const [features, count] = await Promise.all([
      this.getCartSubmissionFeatures(cartId, pagination, submissionFeatureId),
      this.getCartSubmissionFeatureCount(cartId)
    ]);

    return {
      features,
      pagination: makePaginationResponse(count, pagination)
    };
  }
}
