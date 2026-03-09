import { getKnex } from '../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
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
    const query = knex('cart')
      .where('cart_id', cartId)
      .select('cart_id', 'cart_status', 'system_user_id', 'record_end_date');

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
    const query = knex('cart')
      .where('cart_id', cartId)
      .select('cart_id', 'cart_status', 'system_user_id', 'record_end_date');

    const response = await this.connection.knex(query, Cart);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('Cart not found', ['CartRepository->getCartById', { cartId }]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'CartRepository->getCartById',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
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
      .returning(['cart_id', 'cart_status', 'system_user_id', 'record_end_date']);

    const response = await this.connection.knex(query, Cart);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to create cart', [
        'CartRepository->createCart',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }
    return response.rows[0];
  }

  /**
   * Update a cart.
   *
   * @param {string} cartId
   * @param {UpdateCart} cart
   * @return {Promise<void>}
   * @memberof CartRepository
   */
  async updateCart(cartId: string, cart: UpdateCart): Promise<void> {
    const knex = getKnex();

    const query = knex('cart').where('cart_id', cartId).update(cart);

    const response = await this.connection.knex(query, Cart);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update cart', [
        'CartRepository->updateCart',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
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
