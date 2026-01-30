import SQL from 'sql-template-strings';
import z from 'zod';
import { getKnex } from '../database/db';
import { CartStatus, CartSubmissionFeature } from '../models/cart';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { BaseRepository } from './base-repository';

/**
 * CartSubmissionFeature repository class.
 * Handles interactions with the cart_submission_feature table for adding, removing, and querying submission features for a cart.
 *
 * @export
 * @class CartSubmissionFeatureRepository
 * @extends {BaseRepository}
 */
export class CartSubmissionFeatureRepository extends BaseRepository {
  /**
   * Add multiple submission features to an active cart.
   * Ignores existing relationships (idempotent).
   * Verifies cart ownership via systemUserId and ensures the cart is active.
   *
   * @param {string} cartId - The ID of the cart
   * @param {number} systemUserId - The ID of the authenticated user
   * @param {number[]} submissionFeatureIds - The list of submission feature IDs to add
   * @return {Promise<void>} - Resolves when the features are added to the cart
   * @memberof CartSubmissionFeatureRepository
   */
  async addSubmissionFeaturesToCart(
    cartId: string,
    systemUserId: number,
    submissionFeatureIds: number[]
  ): Promise<void> {
    const sql = SQL`
    WITH w_cart AS (
      SELECT cart_id
      FROM cart
      WHERE cart_id = ${cartId}
        AND system_user_id = ${systemUserId} 
        AND cart_status = ${CartStatus.ACTIVE}
    ),
    w_features AS (
      SELECT unnest(${submissionFeatureIds}::integer[]) AS submission_feature_id
    ),
    w_valid_features AS (
      SELECT wf.submission_feature_id
      FROM w_features wf
      LEFT JOIN submission_feature_security sfs 
        ON sfs.submission_feature_id = wf.submission_feature_id
      WHERE sfs.record_end_date IS NULL 
         OR sfs.record_end_date > now()
    )
    INSERT INTO cart_submission_feature (cart_id, submission_feature_id)
    SELECT wc.cart_id, wvf.submission_feature_id
    FROM w_cart wc
    CROSS JOIN w_valid_features wvf
    ON CONFLICT (cart_id, submission_feature_id) DO NOTHING
  `;

    await this.connection.sql(sql);
  }

  /**
   * Remove submission features from an active cart.
   * Verifies cart ownership via systemUserId and ensures the cart is active.
   *
   * @param {string} cartId - The ID of the cart
   * @param {number} systemUserId - The ID of the authenticated user
   * @param {string[]} cartSubmissionFeatureIds - The list of submission feature IDs to remove
   * @return {Promise<void>} - Resolves when the features are removed from the cart
   * @memberof CartSubmissionFeatureRepository
   */
  async removeSubmissionFeaturesFromCart(
    cartId: string,
    systemUserId: number,
    cartSubmissionFeatureIds: string[]
  ): Promise<void> {
    const knex = getKnex();

    const query = knex('cart_submission_feature as csf')
      .join('cart as c', 'c.cart_id', 'csf.cart_id')
      .where('csf.cart_id', cartId)
      .andWhere('c.system_user_id', systemUserId)
      .andWhere('c.cart_status', CartStatus.ACTIVE)
      .whereIn('csf.cart_submission_feature_id', cartSubmissionFeatureIds)
      .del();

    await this.connection.knex(query);
  }

  /**
   * Remove all submission features from an active cart.
   * Verifies cart ownership via systemUserId and ensures the cart is active.
   *
   * @param {string} cartId - The ID of the cart
   * @param {number} systemUserId - The ID of the authenticated user
   * @return {Promise<void>} - Resolves when all features are removed from the cart
   * @memberof CartSubmissionFeatureRepository
   */
  async clearCart(cartId: string, systemUserId: number): Promise<void> {
    const knex = getKnex();
    const query = knex('cart_submission_feature as csf')
      .join('cart as c', 'c.cart_id', 'csf.cart_id')
      .where('csf.cart_id', cartId)
      .andWhere('c.system_user_id', systemUserId)
      .andWhere('c.cart_status', CartStatus.ACTIVE)
      .del();

    await this.connection.knex(query);
  }

  /**
   * Get all submission features in an active cart with pagination.
   * Excludes secured features where the submission_feature_id is present in submission_feature_security.
   * Verifies cart ownership via systemUserId and ensures the cart is active.
   *
   * @param {string} cartId - The ID of the cart
   * @param {number} systemUserId - The ID of the authenticated user
   * @param {ApiPaginationOptions} [pagination] - Optional pagination options
   * @return {Promise<CartSubmissionFeature[]>} - Paginated list of submission features
   * @memberof CartSubmissionFeatureRepository
   */
  async getCartSubmissionFeatures(
    cartId: string,
    systemUserId: number,
    pagination?: ApiPaginationOptions
  ): Promise<CartSubmissionFeature[]> {
    const knex = getKnex();

    const baseQuery = knex('submission_feature as sf')
      .join('feature_type as ft', 'ft.feature_type_id', 'sf.feature_type_id')
      .join('cart_submission_feature as csf', 'csf.submission_feature_id', 'sf.submission_feature_id')
      .join('cart as c', 'c.cart_id', 'csf.cart_id')
      .where('csf.cart_id', cartId)
      .andWhere('c.system_user_id', systemUserId)
      .andWhere('c.cart_status', CartStatus.ACTIVE)
      .leftJoin('submission_feature_security as sfs', 'sfs.submission_feature_id', 'sf.submission_feature_id')
      .where((qb) => {
        qb.whereNull('sfs.record_end_date').orWhere('sfs.record_end_date', '>', knex.fn.now());
      })
      .select(
        'csf.cart_submission_feature_id',
        'sf.submission_feature_id',
        'sf.submission_id',
        'sf.feature_type_id',
        'ft.name as feature_type_name',
        knex.raw(
          'EXISTS (SELECT 1 FROM submission_feature_security sfs WHERE sfs.submission_feature_id = sf.submission_feature_id AND (sfs.record_end_date IS NULL OR sfs.record_end_date > NOW())) AS secured'
        )
      );

    const paginatedQuery = this.applyPagination(baseQuery, pagination);

    const response = await this.connection.knex(paginatedQuery, CartSubmissionFeature);

    return response.rows;
  }

  /**
   * Get the total number of submission features in an active cart.
   * Excludes secured features.
   * Verifies cart ownership via systemUserId and ensures the cart is active.
   *
   * @param {string} cartId - The ID of the cart
   * @param {number} systemUserId - The ID of the authenticated user
   * @return {Promise<number>} - The total number of submission features in the cart
   * @memberof CartSubmissionFeatureRepository
   */
  async getCartSubmissionFeatureCount(cartId: string, systemUserId: number): Promise<number> {
    const knex = getKnex();
    const query = knex('cart_submission_feature as csf')
      .join('cart as c', 'c.cart_id', 'csf.cart_id')
      .leftJoin('submission_feature_security as sfs', 'sfs.submission_feature_id', 'csf.submission_feature_id')
      .where('csf.cart_id', cartId)
      .andWhere('c.system_user_id', systemUserId)
      .andWhere('c.cart_status', CartStatus.ACTIVE)
      .where((qb) => {
        qb.whereNull('sfs.record_end_date').orWhere('sfs.record_end_date', '>', knex.fn.now());
      })
      .select(knex.raw('count(*)::integer as count'));

    const response = await this.connection.knex(query, z.object({ count: z.number() }));

    return response.rows[0].count;
  }
}
