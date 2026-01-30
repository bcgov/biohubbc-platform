import { IDBConnection } from '../database/db';
import { Cart, CartSubmissionFeature, CartWithFeatures, UpdateCart } from '../models/cart';
import { CartRepository } from '../repositories/cart-repository';
import { CartSubmissionFeatureService } from './cart-submission-feature-service';
import { DBService } from './db-service';

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
   * @return {Promise<CartWithFeatures>} - The cart with features
   * @memberof CartService
   */
  async findCartWithFeaturesById(cartId: string): Promise<CartWithFeatures> {
    const cart = await this.cartRepository.getCartById(cartId);

    const pagination = { limit: 10, page: 1 };
    const features = await this.cartSubmissionFeatureService.getCartSubmissionFeatures(cartId, pagination);

    return { ...cart, features };
  }

  /**
   * Find a cart by its ID
   *
   * @param {string} cartId - The ID of the cart
   * @return {Promise<Cart | null>} - The cart
   * @memberof CartService
   */
  async findCartById(cartId: string): Promise<Cart | null> {
    return this.cartRepository.findCartById(cartId);
  }

  /**
   * Returns a specific cart by its ID.
   *
   * @param {string} cartId - The ID of the cart
   * @return {Promise<Cart>} - The cart
   * @memberof CartService
   */
  async getCartById(cartId: string): Promise<Cart> {
    return this.cartRepository.getCartById(cartId);
  }

  /**
   * Creates a new cart for a system user with optional submission features.
   *
   * @param {number | null} systemUserId - The ID of the authenticated user. Null if not authenticated.
   * @param {number[]} submissionFeatureIds - The list of submission feature IDs to add to the cart
   * @return {Promise<CartWithFeatures>} - The newly created cart with features
   * @memberof CartService
   */
  async createCart(systemUserId: number | null, submissionFeatureIds: number[]): Promise<CartWithFeatures> {
    const cart = await this.cartRepository.createCart(systemUserId);

    let features: CartSubmissionFeature[] = [];

    if (submissionFeatureIds.length > 0) {
      await this.cartSubmissionFeatureService.addSubmissionFeaturesToCart(cart.cart_id, submissionFeatureIds);
      features = await this.cartSubmissionFeatureService.getCartSubmissionFeatures(cart.cart_id);
    }

    return { ...cart, features };
  }

  /**
   * Updates a cart.
   *
   * @param {string} cartId - The ID of the cart
   * @param {UpdateCart} payload - The new cart update payload
   * @return {Promise<void>}
   * @memberof CartService
   */
  async updateCart(cartId: string, payload: UpdateCart): Promise<void> {
    await this.cartRepository.updateCart(cartId, payload);
  }

  /**
   * Soft delete a cart.
   *
   * @param {string} cartId - The ID of the cart
   * @return {Promise<void>}
   * @memberof CartService
   */
  async deleteCart(cartId: string): Promise<void> {
    await this.cartRepository.deleteCart(cartId);
  }
}
