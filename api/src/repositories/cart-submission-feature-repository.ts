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
   * Add unsecured submission features to an active cart (anonymous path).
   * Walks up the ancestor chain from each candidate feature; if any ancestor has an
   * active submission_feature_security row, the feature is excluded.
   * Ignores existing relationships (idempotent via ON CONFLICT DO NOTHING).
   *
   * @param {string} cartId - The ID of the cart
   * @param {number[]} submissionFeatureIds - The list of submission feature IDs to add
   * @return {Promise<void>}
   * @memberof CartSubmissionFeatureRepository
   */
  async createUnsecuredCartSubmissionFeatures(cartId: string, submissionFeatureIds: number[]): Promise<void> {
    const sql = SQL`
      WITH w_cart AS (
        SELECT cart_id
        FROM cart
        WHERE cart_id = ${cartId}
          AND cart_status = ${CartStatus.ACTIVE}
      ),
      w_features AS (
        SELECT unnest(${submissionFeatureIds}::INTEGER[]) AS submission_feature_id
      ),
      w_valid_features AS (
        SELECT wf.submission_feature_id
        FROM w_features wf
        WHERE NOT EXISTS (
          WITH RECURSIVE ancestors AS (
            SELECT sf_inner.submission_feature_id AS ancestor_id,
                   sf_inner.parent_submission_feature_id
            FROM submission_feature sf_inner
            WHERE sf_inner.submission_feature_id = wf.submission_feature_id
            UNION ALL
            SELECT p.submission_feature_id, p.parent_submission_feature_id
            FROM submission_feature p
            JOIN ancestors a ON p.submission_feature_id = a.parent_submission_feature_id
          )
          SELECT 1
          FROM ancestors a
          INNER JOIN submission_feature_security sfs
            ON sfs.submission_feature_id = a.ancestor_id
          WHERE sfs.record_end_date IS NULL
        )
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
   * Add submission features to an active cart with scope-based access check (authenticated path).
   * Allows features that are unsecured OR where the user has scope access via
   * security_scope_anchor → team_security_scope → team_member.
   * Ignores existing relationships (idempotent via ON CONFLICT DO NOTHING).
   *
   * @param {string} cartId - The ID of the cart
   * @param {number[]} submissionFeatureIds - The list of submission feature IDs to add
   * @param {number} systemUserId - The authenticated user's ID
   * @return {Promise<void>}
   * @memberof CartSubmissionFeatureRepository
   */
  async createCartSubmissionFeaturesWithScopeCheck(
    cartId: string,
    submissionFeatureIds: number[],
    systemUserId: number
  ): Promise<void> {
    const sql = SQL`
      WITH w_cart AS (
        SELECT cart_id
        FROM cart
        WHERE cart_id = ${cartId}
          AND cart_status = ${CartStatus.ACTIVE}
      ),
      w_features AS (
        SELECT unnest(${submissionFeatureIds}::INTEGER[]) AS submission_feature_id
      ),
      w_valid_features AS (
        SELECT wf.submission_feature_id
        FROM w_features wf
        WHERE EXISTS (
          SELECT 1
          FROM (
            WITH RECURSIVE ancestors AS (
              SELECT sf_inner.submission_feature_id AS ancestor_id,
                     sf_inner.parent_submission_feature_id
              FROM submission_feature sf_inner
              WHERE sf_inner.submission_feature_id = wf.submission_feature_id
              UNION ALL
              SELECT p.submission_feature_id, p.parent_submission_feature_id
              FROM submission_feature p
              JOIN ancestors a ON p.submission_feature_id = a.parent_submission_feature_id
            )
            SELECT array_agg(ancestor_id) AS ancestor_ids
            FROM ancestors
          ) anc
          WHERE
            NOT EXISTS (
              SELECT 1 FROM submission_feature_security sfs
              WHERE sfs.record_end_date IS NULL
                AND sfs.submission_feature_id = ANY(anc.ancestor_ids)
            )
            OR EXISTS (
              SELECT 1
              FROM security_scope_anchor ssa
                JOIN team_security_scope tss ON tss.security_scope_id = ssa.security_scope_id
                JOIN team_member tm ON tm.team_id = tss.team_id
                  AND tm.system_user_id = ${systemUserId}
                  AND tm.record_end_date IS NULL
              WHERE ssa.anchor_submission_feature_id = ANY(anc.ancestor_ids)
            )
        )
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
   *
   * @param {string} cartId - The ID of the cart
   * @param {string[]} cartSubmissionFeatureIds - The list of submission feature IDs to remove
   * @return {Promise<void>} - Resolves when the features are removed from the cart
   * @memberof CartSubmissionFeatureRepository
   */
  async removeSubmissionFeaturesFromCart(cartId: string, cartSubmissionFeatureIds: string[]): Promise<void> {
    const knex = getKnex();

    const query = knex('cart_submission_feature as csf')
      .join('cart as c', 'c.cart_id', 'csf.cart_id')
      .where('csf.cart_id', cartId)
      .andWhere('c.cart_status', CartStatus.ACTIVE)
      .whereIn('csf.cart_submission_feature_id', cartSubmissionFeatureIds)
      .del();

    await this.connection.knex(query);
  }

  /**
   * Remove all submission features from an active cart.
   *
   * @param {string} cartId - The ID of the cart
   * @return {Promise<void>} - Resolves when all features are removed from the cart
   * @memberof CartSubmissionFeatureRepository
   */
  async clearCart(cartId: string): Promise<void> {
    const knex = getKnex();
    const query = knex('cart_submission_feature as csf')
      .join('cart as c', 'c.cart_id', 'csf.cart_id')
      .where('csf.cart_id', cartId)
      .andWhere('c.cart_status', CartStatus.ACTIVE)
      .del();

    await this.connection.knex(query);
  }

  /**
   * Get all submission feature IDs in a cart (unpaginated).
   * Used by checkout to copy cart contents to download_feature
   * without fetching full feature metadata.
   *
   * @param {string} cartId - The ID of the cart
   * @return {Promise<number[]>} - Array of submission feature IDs
   * @memberof CartSubmissionFeatureRepository
   */
  async getCartSubmissionFeatureIds(cartId: string): Promise<number[]> {
    const knex = getKnex();
    const query = knex('cart_submission_feature as csf')
      .join('cart as c', 'c.cart_id', 'csf.cart_id')
      .where('csf.cart_id', cartId)
      .andWhere('c.cart_status', CartStatus.ACTIVE)
      .select('csf.submission_feature_id');

    const response = await this.connection.knex(query);

    return response.rows.map((row: { submission_feature_id: number }) => row.submission_feature_id);
  }

  /**
   * Get all submission features in an active cart with pagination, optionally filtered by submission feature ID.
   * Returns ALL features in the cart — authorization was enforced at insert time, not on read.
   * The `secured` field reflects current effective security status (feature or any ancestor has
   * an active submission_feature_security row), computed via a bulk recursive CTE.
   *
   * @param {string} cartId - The ID of the cart
   * @param {ApiPaginationOptions} [pagination] - Optional pagination options
   * @param {number} [submissionFeatureId] - Optional submission feature ID to filter by
   * @return {Promise<CartSubmissionFeature[]>} - Paginated list of submission features
   * @memberof CartSubmissionFeatureRepository
   */
  async getCartSubmissionFeatures(
    cartId: string,
    pagination?: ApiPaginationOptions,
    submissionFeatureId?: number
  ): Promise<CartSubmissionFeature[]> {
    const knex = getKnex();

    // Step 1: Build the base page of cart features (paginated BEFORE the recursive ancestor walk)
    const pageQuery = knex
      .select('csf.cart_submission_feature_id', 'csf.submission_feature_id')
      .from('cart_submission_feature as csf')
      .join('cart as c', 'c.cart_id', 'csf.cart_id')
      .where('csf.cart_id', cartId)
      .andWhere('c.cart_status', CartStatus.ACTIVE);

    if (submissionFeatureId) {
      pageQuery.andWhere('csf.submission_feature_id', submissionFeatureId);
    }

    const paginatedPageQuery = this.applyPagination(pageQuery, pagination);

    // Step 2: Join feature metadata, check security via per-row correlated EXISTS
    const query = knex
      .with('page', paginatedPageQuery)
      .select(
        'page.cart_submission_feature_id',
        'sf.submission_feature_id',
        'sf.submission_id',
        'sf.feature_type_id',
        'ft.name as feature_type_name',
        knex.raw(`EXISTS (
          WITH RECURSIVE ancestor_chain(id) AS (
            SELECT sf.submission_feature_id
            UNION ALL
            SELECT p.parent_submission_feature_id
            FROM ancestor_chain ac
            JOIN submission_feature p ON p.submission_feature_id = ac.id
            WHERE p.parent_submission_feature_id IS NOT NULL
              AND p.record_end_date IS NULL
          )
          SELECT 1 FROM ancestor_chain ac
          JOIN submission_feature_security sfs ON sfs.submission_feature_id = ac.id
          WHERE sfs.record_end_date IS NULL
        ) AS secured`)
      )
      .from('page')
      .join('submission_feature as sf', 'sf.submission_feature_id', 'page.submission_feature_id')
      .join('feature_type as ft', 'ft.feature_type_id', 'sf.feature_type_id');

    const response = await this.connection.knex(query, CartSubmissionFeature);

    return response.rows;
  }

  /**
   * Get the total number of submission features in an active cart.
   * Counts ALL features — authorization was enforced at insert time, not on read.
   *
   * @param {string} cartId - The ID of the cart
   * @return {Promise<number>} - The total number of submission features in the cart
   * @memberof CartSubmissionFeatureRepository
   */
  async getCartSubmissionFeatureCount(cartId: string): Promise<number> {
    const knex = getKnex();

    const query = knex('cart_submission_feature as csf')
      .join('cart as c', 'c.cart_id', 'csf.cart_id')
      .where('csf.cart_id', cartId)
      .andWhere('c.cart_status', CartStatus.ACTIVE)
      .select(knex.raw('count(*)::integer as count'));

    const response = await this.connection.knex(query, z.object({ count: z.number() }));

    return response.rows[0].count;
  }
}
