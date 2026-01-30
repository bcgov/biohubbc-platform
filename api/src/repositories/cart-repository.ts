import { getKnex } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import { Cart, UpdateCart } from '../models/cart';
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
   * Get a specific cart by its ID. Throws an error if cart does not exist.
   *
   * @param {string} cartId
   * @param {number} systemUserId
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
   * @param {number} systemUserId
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
   * Update a cart.
   *
   * @param {string} cartId
   * @param {number} systemUserId
   * @param {UpdateCart} payload
   * @return {Promise<void>}
   * @memberof CartRepository
   */
  async updateCart(cartId: string, systemUserId: number, payload: UpdateCart): Promise<void> {
    const knex = getKnex();

    const query = knex('cart')
      .where('cart_id', cartId)
      .andWhere('system_user_id', systemUserId)
      .update({ cart_status: payload.cart_status, record_end_date: payload.record_end_date });

    const response = await this.connection.knex(query, Cart);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update cart status', [
        'CartRepository->updateCartStatus',
        'rowCount !== 1, expected rowCount === 1'
      ]);
    }
  }

  /**
   * Soft delete a cart
   *
   * @param {string} cartId
   * @param {number} systemUserId
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
