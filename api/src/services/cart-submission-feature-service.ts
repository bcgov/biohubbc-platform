import { IDBConnection } from '../database/db';
import { CartSubmissionFeatureRepository } from '../repositories/cart-submission-feature-repository';
import { SubmissionFeature } from '../repositories/submission-repository';
import { getLogger } from '../utils/logger';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { DBService } from './db-service';

const defaultLog = getLogger('services/cart-submission-feature-service');

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
   * @param {number[]} submissionFeatureIds - The list of submission feature IDs to add
   * @param {number} systemUserId - The ID of the authenticated user
   * @return {Promise<void>}
   * @memberof CartSubmissionFeatureService
   */
  async addSubmissionFeaturesToCart(
    cartId: string,
    submissionFeatureIds: number[],
    systemUserId: number
  ): Promise<void> {
    defaultLog.debug({
      label: 'addSubmissionFeaturesToCart',
      cartId,
      submissionFeatureIds
    });
    await this.cartSubmissionFeatureRepository.addSubmissionFeaturesToCart(cartId, submissionFeatureIds, systemUserId);
  }

  /**
   * Removes submission features from a cart.
   *
   * @param {string} cartId - The ID of the cart
   * @param {number[]} submissionFeatureIds - The list of submission feature IDs to remove
   * @param {number} systemUserId - The ID of the authenticated user
   * @return {Promise<void>}
   * @memberof CartSubmissionFeatureService
   */
  async removeSubmissionFeaturesFromCart(
    cartId: string,
    submissionFeatureIds: number[],
    systemUserId: number
  ): Promise<void> {
    defaultLog.debug({
      label: 'removeSubmissionFeaturesFromCart',
      cartId,
      submissionFeatureIds
    });
    await this.cartSubmissionFeatureRepository.removeSubmissionFeaturesFromCart(
      cartId,
      submissionFeatureIds,
      systemUserId
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
    defaultLog.debug({ label: 'clearCart', cartId });
    await this.cartSubmissionFeatureRepository.clearCart(cartId, systemUserId);
  }

  /**
   * Get submission features in a cart
   *
   * @param {string} cartId - The ID of the cart
   * @param {number} systemUserId - The ID of the authenticated user
   * @param {ApiPaginationOptions} [pagination] - Optional pagination options
   * @return {Promise<SubmissionFeature[]>}
   * @memberof CartSubmissionFeatureService
   */
  async getCartSubmissionFeatures(
    cartId: string,
    systemUserId: number,
    pagination?: ApiPaginationOptions
  ): Promise<SubmissionFeature[]> {
    defaultLog.debug({ label: 'getCartSubmissionFeatures', cartId });
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
    defaultLog.debug({ label: 'getCartSubmissionFeatureCount', cartId });
    return this.cartSubmissionFeatureRepository.getCartSubmissionFeatureCount(cartId, systemUserId);
  }
}
