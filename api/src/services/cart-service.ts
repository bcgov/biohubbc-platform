import { IDBConnection } from '../database/db';
import { HTTP400 } from '../errors/http-error';
import { Cart, CartWithFeatures, CartWithFeaturesResponse, UpdateCart } from '../models/cart';
import { DownloadId } from '../models/download';
import { publishProcessDownloadJob } from '../queue/publisher';
import { CartRepository } from '../repositories/cart-repository';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { TeamService } from './access-policy/team-service';
import { CartSubmissionFeatureService } from './cart-submission-feature-service';
import { DBService } from './db-service';
import { DownloadService } from './download/download-service';

/**
 * Service for managing carts and cart submission features.
 */
export class CartService extends DBService {
  cartRepository: CartRepository;
  cartSubmissionFeatureService: CartSubmissionFeatureService;
  downloadService: DownloadService;
  teamService: TeamService;

  /**
   * Mutable dependency bag used by tests to avoid stubbing module namespace exports under ESM.
   */
  static readonly dependencies = {
    publishProcessDownloadJob
  };

  /**
   * Initializes the CartService with a database connection.
   *
   * @param {IDBConnection} connection
   * @memberof CartService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.cartRepository = new CartRepository(connection);
    this.cartSubmissionFeatureService = new CartSubmissionFeatureService(connection);
    this.downloadService = new DownloadService(connection);
    this.teamService = new TeamService(connection);
  }

  /**
   * Returns a specific cart by its ID with paginated features
   *
   * @param {string} cartId - The ID of the cart
   * @param {pagination} pagination
   * @return {Promise<CartWithFeatures>} - The cart with features
   * @memberof CartService
   */
  async findCartWithFeaturesById(cartId: string, pagination?: ApiPaginationOptions): Promise<CartWithFeatures> {
    const [cart, features] = await Promise.all([
      this.cartRepository.getCartById(cartId),
      this.cartSubmissionFeatureService.getCartSubmissionFeatures(cartId, pagination)
    ]);
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
   * Returns the newly created cart with features and pagination information.
   *
   * @param {number | null} systemUserId - The ID of the authenticated user. Null if not authenticated.
   * @param {number[]} submissionFeatureIds - The list of submission feature IDs to add to the cart
   * @param {ApiPaginationOptions} pagination - Pagination options for the response. Defaults to {page: 1, limit: 25}
   * @return {Promise<CartWithFeaturesResponse>} - The newly created cart with features and pagination
   * @memberof CartService
   */
  async createCart(
    systemUserId: number | null,
    submissionFeatureIds: number[],
    pagination?: ApiPaginationOptions
  ): Promise<CartWithFeaturesResponse> {
    const cart = await this.cartRepository.createCart(systemUserId);

    if (submissionFeatureIds.length > 0) {
      await this.cartSubmissionFeatureService.createCartSubmissionFeatures(
        cart.cart_id,
        submissionFeatureIds,
        systemUserId
      );
    }

    // Fetch paginated features with provided pagination or defaults
    const { features, pagination: paginationResult } =
      await this.cartSubmissionFeatureService.getPaginatedCartFeaturesResponse(
        cart.cart_id,
        pagination ?? { page: 1, limit: 25 }
      );

    return {
      cart,
      features,
      pagination: paginationResult
    };
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
   * Soft-deprecated: cart checkout no longer creates downloads. The sibling
   * cart-deprecation ticket removes this method and its endpoint entirely.
   *
   * @memberof CartService
   */
  async checkoutCart(_cartId: string, _systemUserId: number | null): Promise<DownloadId> {
    throw new HTTP400(
      'Cart checkout is being retired. Use POST /api/download with an expression instead.'
    );
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
