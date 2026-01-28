import { IDBConnection } from '../database/db';
import { HTTP400, HTTP401 } from '../errors/http-error';
import { Cart, CartStatus, CartWithFeatures, UpdateCartFeatures } from '../models/cart';
import { CartRepository } from '../repositories/cart-repository';
import { SubmissionFeature } from '../repositories/submission-repository';
import { getLogger } from '../utils/logger';
import { ApiPaginationOptions } from '../zod-schema/pagination';
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

    const cart = await this.cartRepository.findCartById(cartId, systemUserId);

    if (!cart) {
      // Access denied to prevent leaking information about the cart existing
      throw new HTTP401('Access Denied');
    }

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
   * @param {number[]} submissionFeatureIds - The list of submission feature IDs to add to the cart
   * @return {Promise<CartWithFeatures>} - The newly created cart with features
   * @memberof CartService
   */
  async createCart(systemUserId: number, submissionFeatureIds: number[]): Promise<CartWithFeatures> {
    defaultLog.debug({ label: 'createCart', systemUserId });

    const cart = await this.cartRepository.createCart(systemUserId);

    let features: SubmissionFeature[] = [];

    if (submissionFeatureIds.length > 0) {
      await this.cartSubmissionFeatureService.addSubmissionFeaturesToCart(
        cart.cart_id,
        submissionFeatureIds,
        systemUserId
      );
      features = await this.cartSubmissionFeatureService.getCartSubmissionFeatures(cart.cart_id, systemUserId);
    }

    return { ...cart, features };
  }

  /**
   * Updates the status of a cart.
   *
   * @param {string} cartId - The ID of the cart
   * @param {CartStatus} status - The new cart status
   * @param {number} systemUserId - The ID of the authenticated user
   * @return {Promise<void>}
   * @memberof CartService
   */
  async updateCartStatus(cartId: string, status: CartStatus, systemUserId: number): Promise<void> {
    defaultLog.debug({ label: 'updateCartStatus', cartId, status });

    await this.cartRepository.updateCartStatus(cartId, status, systemUserId);
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

  /**
   * Validates that a cart exists and is active.
   *
   * @private
   * @param {Cart | null} cart - The cart to validate
   * @throws {HTTP400} - If cart is not found or not active
   * @memberof CartService
   */
  private _validateCart(cart: Cart | null): void {
    if (!cart) {
      throw new HTTP400('Cart not found');
    }
    if (cart.cart_status !== CartStatus.ACTIVE) {
      throw new HTTP400('Cart is not active');
    }
  }

  /**
   * Updates cart features by adding and removing submission features.
   *
   * @param {string} cartId - The ID of the cart
   * @param {number} systemUserId - The ID of the authenticated user
   * @param {UpdateCartFeatures} updateCartFeatures - The features to add and remove
   * @return {Promise<void>}
   * @memberof CartService
   */
  async updateCartFeatures(
    cartId: string,
    systemUserId: number,
    updateCartFeatures: UpdateCartFeatures
  ): Promise<void> {
    defaultLog.debug({ label: 'updateCartFeatures', cartId, updateCartFeatures });

    const cart = await this.cartRepository.findCartById(cartId, systemUserId);
    this._validateCart(cart);

    const { add, remove } = updateCartFeatures;

    await Promise.all([
      this.cartSubmissionFeatureService.addSubmissionFeaturesToCart(cartId, add, systemUserId),
      this.cartSubmissionFeatureService.removeSubmissionFeaturesFromCart(cartId, remove, systemUserId)
    ]);
  }

  /**
   * Clears all submission features from a cart.
   *
   * @param {string} cartId - The ID of the cart
   * @param {number} systemUserId - The ID of the authenticated user
   * @return {Promise<void>}
   * @memberof CartService
   */
  async clearCart(cartId: string, systemUserId: number): Promise<void> {
    defaultLog.debug({ label: 'clearCart', cartId });

    const cart = await this.cartRepository.findCartById(cartId, systemUserId);
    this._validateCart(cart);

    await this.cartSubmissionFeatureService.clearCart(cartId, systemUserId);
  }

  /**
   * Returns submission features in a cart.
   *
   * @param {string} cartId - The ID of the cart
   * @param {number} systemUserId - The ID of the authenticated user
   * @param {ApiPaginationOptions} [pagination] - Optional pagination options
   * @return {Promise<SubmissionFeature[]>} - The submission features in the cart
   * @memberof CartService
   */
  async getCartSubmissionFeatures(
    cartId: string,
    systemUserId: number,
    pagination?: ApiPaginationOptions
  ): Promise<SubmissionFeature[]> {
    defaultLog.debug({ label: 'getCartSubmissionFeatures', cartId });

    const cart = await this.cartRepository.findCartById(cartId, systemUserId);
    this._validateCart(cart);

    return this.cartSubmissionFeatureService.getCartSubmissionFeatures(cartId, systemUserId, pagination);
  }
}
