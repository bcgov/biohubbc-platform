import { getKnex } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import { Cart, CartStatus } from '../models/cart';
import { BaseRepository } from './base-repository';

/**
 * Cart repository class.
 *
 * @export
 * @class CartRepository
 * @extends {BaseRepository}
 */
export class CartRepository extends BaseRepository {
  /**
   * Find a cart by its ID. Returns null if the cart does not exist, unlike `getCartById`, which throws an error.
   * This method allows for custom error messages to prevent leaking whether a cart exists.
   *
   * @param {string} cartId
   * @param {number} systemUserId - The ID of the authenticated user
   * @return {Promise<Cart | null>}
   * @memberof CartRepository
   */
  async findCartById(cartId: string, systemUserId: number): Promise<Cart | null> {
    const knex = getKnex();
    const query = knex('cart')
      .where('cart_id', cartId)
      .andWhere('system_user_id', systemUserId)
      .select('cart_id', 'cart_status', 'system_user_id');

    const response = await this.connection.knex(query, Cart);
    return response.rows[0] ?? null;
  }

  /**
   * Get a specific cart by its ID. Throws an error if cart does not exist.
   *
   * @param {string} cartId
   * @param {number} systemUserId - The ID of the authenticated user
   * @return {Promise<Cart>}
   * @memberof CartRepository
   */
  async getCartById(cartId: string, systemUserId: number): Promise<Cart> {
    const knex = getKnex();
    const query = knex('cart')
      .where('cart_id', cartId)
      .andWhere('system_user_id', systemUserId)
      .select('cart_id', 'cart_status', 'system_user_id');

    const response = await this.connection.knex(query, Cart);
    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get cart', [
        'CartRepository->getCartById',
        'rowCount !== 1, expected rowCount === 1'
      ]);
    }
    return response.rows[0];
  }

  /**
   * Create a new cart.
   *
   * @param {number} systemUserId - The ID of the authenticated user
   * @return {Promise<Cart>}
   * @memberof CartRepository
   */
  async createCart(systemUserId: number): Promise<Cart> {
    const knex = getKnex();
    const query = knex('cart')
      .insert({
        system_user_id: systemUserId,
        cart_status: 'active'
      })
      .returning(['cart_id', 'cart_status', 'system_user_id']);

    const response = await this.connection.knex(query, Cart);
    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to create cart', [
        'CartRepository->createCart',
        'rowCount !== 1, expected rowCount === 1'
      ]);
    }
    return response.rows[0];
  }

  /**
   * Update the status of a cart.
   *
   * @param {string} cartId
   * @param {CartStatus} status
   * @param {number} systemUserId - The ID of the authenticated user
   * @return {Promise<void>}
   * @memberof CartRepository
   */
  async updateCartStatus(cartId: string, status: CartStatus, systemUserId: number): Promise<void> {
    const knex = getKnex();
    const query = knex('cart')
      .where('cart_id', cartId)
      .andWhere('system_user_id', systemUserId)
      .update({ cart_status: status });

    const response = await this.connection.knex(query, Cart);
    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update cart status', [
        'CartRepository->updateCartStatus',
        'rowCount !== 1, expected rowCount === 1'
      ]);
    }
  }

  /**
   * Remove all submission features from a cart.
   *
   * @param {string} cartId
   * @param {number} systemUserId - The ID of the authenticated user
   * @return {Promise<void>}
   * @memberof CartRepository
   */
  async clearCart(cartId: string, systemUserId: number): Promise<void> {
    const knex = getKnex();
    const query = knex('cart_submission_feature as csf')
      .join('cart as c', 'c.cart_id', 'csf.cart_id')
      .where('csf.cart_id', cartId)
      .andWhere('c.system_user_id', systemUserId)
      .del();

    await this.connection.knex(query, Cart);
  }

  /**
   * Soft delete a cart
   *
   * @param {string} cartId
   * @param {number} systemUserId - The ID of the authenticated user
   * @return {Promise<void>}
   * @memberof CartRepository
   */
  async deleteCart(cartId: string, systemUserId: number): Promise<void> {
    const knex = getKnex();
    const query = knex('cart')
      .where('cart_id', cartId)
      .andWhere('system_user_id', systemUserId)
      .update({ record_end_date: knex.fn.now() });

    await this.connection.knex(query, Cart);
  }
}
