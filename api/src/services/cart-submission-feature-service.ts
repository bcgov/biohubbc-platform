import { IDBConnection } from '../database/db';
import { CartSubmissionFeature } from '../models/cart';
import { CartSubmissionFeatureRepository } from '../repositories/cart-submission-feature-repository';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { DBService } from './db-service';

/**
 * Service for managing submission features associated with carts.
 * Delegates all database operations to CartSubmissionFeatureRepository.
 */
export class CartSubmissionFeatureService extends DBService {
  cartSubmissionFeatureRepository: CartSubmissionFeatureRepository;

  /**
   * Initializes the CartSubmissionFeatureService with a database connection.
   *
   * @param {IDBConnection} connection - Database connection instance
   * @memberof CartSubmissionFeatureService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.cartSubmissionFeatureRepository = new CartSubmissionFeatureRepository(connection);
  }

  /**
   * Adds multiple submission features to a cart.
   *
   * @param {string} cartId - The ID of the cart
   * @param {number} systemUserId - The ID of the authenticated user
   * @param {number[]} submissionFeatureIds - The list of submission feature IDs to add
   * @return {Promise<void>}
   * @memberof CartSubmissionFeatureService
   */
  async addSubmissionFeaturesToCart(
    cartId: string,
    systemUserId: number,
    submissionFeatureIds: number[]
  ): Promise<void> {
    if (submissionFeatureIds.length < 1) {
      return;
    }

    await this.cartSubmissionFeatureRepository.addSubmissionFeaturesToCart(cartId, systemUserId, submissionFeatureIds);
  }

  /**
   * Removes submission features from a cart.
   *
   * @param {string} cartId - The ID of the cart
   * @param {number} systemUserId - The ID of the authenticated user
   * @param {string[]} cartSubmissionFeatureIds - The list of submission feature IDs to remove
   * @return {Promise<void>}
   * @memberof CartSubmissionFeatureService
   */
  async removeSubmissionFeaturesFromCart(
    cartId: string,
    systemUserId: number,
    cartSubmissionFeatureIds: string[]
  ): Promise<void> {
    if (cartSubmissionFeatureIds.length < 1) {
      return;
    }

    await this.cartSubmissionFeatureRepository.removeSubmissionFeaturesFromCart(
      cartId,
      systemUserId,
      cartSubmissionFeatureIds
    );
  }

  /**
   * Clears all submission features from a cart.
   *
   * @param {string} cartId - The ID of the cart
   * @param {number} systemUserId - The ID of the authenticated user
   * @return {Promise<void>}
   * @memberof CartSubmissionFeatureService
   */
  async clearCart(cartId: string, systemUserId: number): Promise<void> {
    await this.cartSubmissionFeatureRepository.clearCart(cartId, systemUserId);
  }

  /**
   * Get submission features in a cart
   *
   * @param {string} cartId - The ID of the cart
   * @param {number} systemUserId - The ID of the authenticated user
   * @param {ApiPaginationOptions} [pagination] - Optional pagination options
   * @return {Promise<CartSubmissionFeature[]>}
   * @memberof CartSubmissionFeatureService
   */
  async getCartSubmissionFeatures(
    cartId: string,
    systemUserId: number,
    pagination?: ApiPaginationOptions
  ): Promise<CartSubmissionFeature[]> {
    return this.cartSubmissionFeatureRepository.getCartSubmissionFeatures(cartId, systemUserId, pagination);
  }

  /**
   * Returns the total number of submission features in a cart.
   *
   * @param {string} cartId - The ID of the cart
   * @param {number} systemUserId - The ID of the authenticated user
   * @return {Promise<number>}
   * @memberof CartSubmissionFeatureService
   */
  async getCartSubmissionFeatureCount(cartId: string, systemUserId: number): Promise<number> {
    return this.cartSubmissionFeatureRepository.getCartSubmissionFeatureCount(cartId, systemUserId);
  }
}
