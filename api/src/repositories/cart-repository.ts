import { getKnex } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import { Cart, CartStatus, UpdateCart } from '../models/cart';
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
   * Find a cart by its ID.
   *
   * @param {string} cartId
   * @return {Promise<Cart | null>}
   * @memberof CartRepository
   */
  async findCartById(cartId: string): Promise<Cart | null> {
    const knex = getKnex();
    const query = knex('cart').where('cart_id', cartId).select('cart_id', 'cart_status', 'system_user_id');

    const response = await this.connection.knex(query, Cart);

    return response.rows[0] ?? null;
  }

  /**
   * Get a specific cart by its ID. Throws an error if cart does not exist.
   *
   * @param {string} cartId
   * @return {Promise<Cart>}
   * @memberof CartRepository
   */
  async getCartById(cartId: string): Promise<Cart> {
    const knex = getKnex();
    const query = knex('cart').where('cart_id', cartId).select('cart_id', 'cart_status', 'system_user_id');

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
   * @param {number | null} systemUserId
   * @return {Promise<Cart>}
   * @memberof CartRepository
   */
  async createCart(systemUserId: number | null): Promise<Cart> {
    const knex = getKnex();
    const query = knex('cart')
      .insert({
        system_user_id: systemUserId,
        cart_status: CartStatus.ACTIVE
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
   * Update a cart.
   *
   * @param {string} cartId
   * @param {UpdateCart} payload
   * @return {Promise<void>}
   * @memberof CartRepository
   */
  async updateCart(cartId: string, payload: UpdateCart): Promise<void> {
    const knex = getKnex();

    const query = knex('cart').where('cart_id', cartId).update(payload);

    const response = await this.connection.knex(query, Cart);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update cart status', [
        'CartRepository->updateCartStatus',
        'rowCount !== 1, expected rowCount === 1'
      ]);
    }
  }

  /**
   * Atomically check out an active cart.
   * Only active carts can be checked out. The WHERE clause filters on
   * cart_status = 'active', preventing double-checkout (idempotent guard).
   * Sets checkout_date and checkout_user to track when and who checked out,
   * separate from the audit trigger's update_date/update_user.
   *
   * @param {string} cartId
   * @param {number | null} checkoutUserId
   * @return {Promise<void>}
   * @memberof CartRepository
   */
  async checkoutCart(cartId: string, checkoutUserId: number | null): Promise<void> {
    const knex = getKnex();
    const query = knex('cart').where('cart_id', cartId).andWhere('cart_status', CartStatus.ACTIVE).update({
      cart_status: CartStatus.CHECKED_OUT,
      checkout_date: knex.fn.now(),
      checkout_user: checkoutUserId
    });

    const response = await this.connection.knex(query);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to checkout cart', [
        'CartRepository->checkoutCart',
        'rowCount !== 1, expected rowCount === 1'
      ]);
    }
  }

  /**
   * Soft delete a cart
   * Requires system user ID to ensure the user owns the cart.
   *
   * @param {string} cartId
   * @return {Promise<void>}
   * @memberof CartRepository
   */
  async deleteCart(cartId: string): Promise<void> {
    const knex = getKnex();
    const query = knex('cart').where('cart_id', cartId).update({ record_end_date: knex.fn.now() });

    await this.connection.knex(query, Cart);
  }
}
