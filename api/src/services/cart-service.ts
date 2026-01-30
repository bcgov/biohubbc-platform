import { IDBConnection } from '../database/db';
import { Cart, CartWithFeatures, UpdateCart } from '../models/cart';
import { CartRepository } from '../repositories/cart-repository';
import { SubmissionFeature } from '../repositories/submission-repository';
import { getLogger } from '../utils/logger';
import { CartSubmissionFeatureService } from './cart-submission-feature-service';
import { DBService } from './db-service';

const defaultLog = getLogger('services/cart-service');

/**
 * Service for managing carts and cart submission features.
 * Delegates all database operations to CartRepository and CartSubmissionFeatureService.
 */
export class CartService extends DBService {
  cartRepository: CartRepository;
  cartSubmissionFeatureService: CartSubmissionFeatureService;

  /**
   * Initializes the CartService with a database connection.
   *
   * @param {IDBConnection} connection - Database connection instance
   * @memberof CartService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.cartRepository = new CartRepository(connection);
    this.cartSubmissionFeatureService = new CartSubmissionFeatureService(connection);
  }

  /**
   * Returns a specific cart by its ID with the first 10 features.
   *
   * @param {string} cartId - The ID of the cart
   * @param {number} systemUserId - The ID of the authenticated user
   * @return {Promise<CartWithFeatures>} - The cart with features
   * @memberof CartService
   */
  async findCartWithFeaturesById(cartId: string, systemUserId: number): Promise<CartWithFeatures> {
    defaultLog.debug({ label: 'findCartWithFeaturesById', cartId });

    const cart = await this.cartRepository.getCartById(cartId, systemUserId);

    const pagination = { limit: 10, page: 1 };
    const features = await this.cartSubmissionFeatureService.getCartSubmissionFeatures(
      cartId,
      systemUserId,
      pagination
    );

    return { ...cart, features };
  }

  /**
   * Returns a specific cart by its ID.
   *
   * @param {string} cartId - The ID of the cart
   * @param {number} systemUserId - The ID of the authenticated user
   * @return {Promise<Cart>} - The cart
   * @memberof CartService
   */
  async getCartById(cartId: string, systemUserId: number): Promise<Cart> {
    defaultLog.debug({ label: 'getCartById', cartId });

    return this.cartRepository.getCartById(cartId, systemUserId);
  }

  /**
   * Creates a new cart for a system user with optional submission features.
   *
   * @param {number} systemUserId - The ID of the authenticated user
   * @param {string[]} submissionFeatureIds - The list of submission feature IDs to add to the cart
   * @return {Promise<CartWithFeatures>} - The newly created cart with features
   * @memberof CartService
   */
  async createCart(systemUserId: number, submissionFeatureIds: string[]): Promise<CartWithFeatures> {
    defaultLog.debug({ label: 'createCart', systemUserId });

    const cart = await this.cartRepository.createCart(systemUserId);

    let features: SubmissionFeature[] = [];

    if (submissionFeatureIds.length > 0) {
      await this.cartSubmissionFeatureService.addSubmissionFeaturesToCart(
        cart.cart_id,
        systemUserId,
        submissionFeatureIds
      );
      features = await this.cartSubmissionFeatureService.getCartSubmissionFeatures(cart.cart_id, systemUserId);
    }

    return { ...cart, features };
  }

  /**
   * Updates a cart.
   *
   * @param {string} cartId - The ID of the cart
   * @param {number} systemUserId - The ID of the authenticated user
   * @param {UpdateCart} payload - The new cart update payload
   * @return {Promise<void>}
   * @memberof CartService
   */
  async updateCart(cartId: string, systemUserId: number, payload: UpdateCart): Promise<void> {
    defaultLog.debug({ label: 'updateCart', cartId, payload });

    await this.cartRepository.updateCart(cartId, systemUserId, payload);
  }

  /**
   * Soft delete a cart.
   *
   * @param {string} cartId - The ID of the cart
   * @param {number} systemUserId - The ID of the authenticated user
   * @return {Promise<void>}
   * @memberof CartService
   */
  async deleteCart(cartId: string, systemUserId: number): Promise<void> {
    defaultLog.debug({ label: 'deleteCart', cartId });

    await this.cartRepository.deleteCart(cartId, systemUserId);
  }
}
