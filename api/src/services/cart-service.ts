import { IDBConnection } from '../database/db';
import { HTTP400 } from '../errors/http-error';
import { Cart, CartStatus, CartWithFeatures, CartWithFeaturesResponse, UpdateCart } from '../models/cart';
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
      await this.cartSubmissionFeatureService.addSubmissionFeaturesToCart(cart.cart_id, submissionFeatureIds);
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
   * Check out a cart: create a download record, link all cart features to it,
   * and mark the cart as checked out.
   *
   * Checkout creates a download record, links features, marks the cart as checked out,
   * then publishes a download job for async processing by the download pipeline.
   * An empty cart checkout would create a useless download record, so the service
   * validates this before creating any records.
   *
   * @param {string} cartId - The ID of the cart to check out
   * @param {number | null} systemUserId - The authenticated user ID, or null for anonymous checkout
   * @param {number} [fragmentSizeBytes] - Target fragment size in bytes. Defaults to FRAGMENT_SIZE_THRESHOLD in the repository.
   * @return {Promise<DownloadId>} The created download record ID
   * @throws HTTP400 if the cart is empty (no features to download)
   * @memberof CartService
   */
  async checkoutCart(cartId: string, systemUserId: number | null, fragmentSizeBytes?: number): Promise<DownloadId> {
    const featureIds = await this.cartSubmissionFeatureService.getCartSubmissionFeatureIds(cartId);

    if (featureIds.length === 0) {
      throw new HTTP400('Cannot checkout an empty cart');
    }

    // Create team if user is authenticated
    let teamId: string | null = null;

    if (systemUserId) {
      const team = await this.teamService.createTeam({
        name: `Team for cart ${cartId}`,
        description: 'Team automatically created for cart checkout',
        system_user_ids: [systemUserId]
      });

      teamId = team.team_id ?? null;
    }

    // Create download record (no data request for cart checkouts)
    const downloadId = await this.downloadService.createDownload({
      teamId,
      dataRequestId: null,
      fragmentSizeBytes,
      systemUserId
    });

    // Link features to download
    await this.downloadService.createDownloadFeatures(downloadId.download_id, featureIds);

    // Mark cart as checked out
    await this.cartRepository.updateCart(cartId, {
      cart_status: CartStatus.CHECKED_OUT,
      checkout_date: new Date().toISOString(),
      checkout_user: systemUserId
    });

    // Publish download job for async processing
    await publishProcessDownloadJob(this.connection, { downloadId: downloadId.download_id });

    return downloadId;
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
