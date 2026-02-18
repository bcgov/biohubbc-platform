import { IDBConnection } from '../database/db';
import { CartFeatureListResponse, CartSubmissionFeature } from '../models/cart';
import { CartSubmissionFeatureRepository } from '../repositories/cart-submission-feature-repository';
import { ensureCompletePaginationOptions, makePaginationResponse } from '../utils/pagination';
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
   * Adds multiple submission features to a cart.
   *
   * @param {string} cartId - The ID of the cart
   * @param {number[]} submissionFeatureIds - The list of submission feature IDs to add
   * @return {Promise<void>}
   * @memberof CartSubmissionFeatureService
   */
  async addSubmissionFeaturesToCart(cartId: string, submissionFeatureIds: number[]): Promise<void> {
    if (submissionFeatureIds.length < 1) {
      return;
    }

    // NOTE: SECURED FEATURES ARE OMITTED IN THE SQL

    await this.cartSubmissionFeatureRepository.addSubmissionFeaturesToCart(cartId, submissionFeatureIds);
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
   * Get submission features in a cart
   *
   * @param {string} cartId - The ID of the cart
   * @param {ApiPaginationOptions} pagination
   * @return {Promise<CartSubmissionFeature[]>}
   * @memberof CartSubmissionFeatureService
   */
  async getCartSubmissionFeatures(cartId: string, pagination?: ApiPaginationOptions): Promise<CartSubmissionFeature[]> {
    return this.cartSubmissionFeatureRepository.getCartSubmissionFeatures(cartId, pagination);
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
   * Returns cart features and pagination payload in the same shape used by cart feature endpoints.
   *
   * @param {string} cartId - The ID of the cart
   * @param {Partial<ApiPaginationOptions>} pagination - Requested pagination parameters
   * @return {Promise<CartFeatureListResponse>}
   * @memberof CartSubmissionFeatureService
   */
  async getPaginatedCartFeaturesResponse(
    cartId: string,
    pagination: Partial<ApiPaginationOptions>
  ): Promise<CartFeatureListResponse> {
    const [features, count] = await Promise.all([
      this.getCartSubmissionFeatures(cartId, ensureCompletePaginationOptions(pagination)),
      this.getCartSubmissionFeatureCount(cartId)
    ]);

    return {
      features,
      pagination: makePaginationResponse(count, pagination)
    };
  }
}
