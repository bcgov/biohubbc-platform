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
   * Add multiple submission features to an active cart with auth-aware security gating.
   * Ignores existing relationships (idempotent via ON CONFLICT DO NOTHING).
   *
   * Security is enforced at insert time only — features already in the cart are NOT
   * re-evaluated on subsequent reads. A feature is "effectively secured" if it or any
   * ancestor has an active submission_feature_security row (record_end_date IS NULL).
   *
   * Anonymous users (systemUserId = null): all effectively secured features are blocked.
   * Authenticated users: effectively secured features are allowed only if the user has
   * scope access via security_scope_anchor → team_security_scope → team_member.
   * Unsecured features are always allowed regardless of auth state.
   *
   * @param {string} cartId - The ID of the cart
   * @param {number[]} submissionFeatureIds - The list of submission feature IDs to add
   * @param {number | null} systemUserId - The authenticated user's ID, or null for anonymous
   * @return {Promise<void>} - Resolves when the features are added to the cart
   * @memberof CartSubmissionFeatureRepository
   */
  async addSubmissionFeaturesToCart(
    cartId: string,
    submissionFeatureIds: number[],
    systemUserId: number | null
  ): Promise<void> {
    const sql =
      systemUserId === null
        ? this.buildAnonymousAddSql(cartId, submissionFeatureIds)
        : this.buildAuthenticatedAddSql(cartId, submissionFeatureIds, systemUserId);

    await this.connection.sql(sql);
  }

  /**
   * Anonymous path: block all effectively secured features.
   * Walks up the ancestor chain from each candidate feature; if any ancestor has an
   * active submission_feature_security row, the feature is excluded.
   */
  private buildAnonymousAddSql(cartId: string, submissionFeatureIds: number[]) {
    return SQL`
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
  }

  /**
   * Authenticated path: allow features that are unsecured OR where the user has scope access.
   * Walks up the ancestor chain, then checks security_scope_anchor → team_security_scope →
   * team_member to determine if the user's team grants access to the secured subtree.
   */
  private buildAuthenticatedAddSql(cartId: string, submissionFeatureIds: number[], systemUserId: number) {
    return SQL`
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

    const baseQuery = knex
      .withRecursive(
        'cart_ancestors',
        knex.raw(
          `
        SELECT csf2.submission_feature_id AS cart_feature_id,
               sf2.submission_feature_id AS ancestor_id,
               sf2.parent_submission_feature_id
        FROM cart_submission_feature csf2
        JOIN submission_feature sf2 ON sf2.submission_feature_id = csf2.submission_feature_id
        JOIN cart c2 ON c2.cart_id = csf2.cart_id
        WHERE csf2.cart_id = ?
          AND c2.cart_status = ?
        UNION ALL
        SELECT ca.cart_feature_id,
               p.submission_feature_id,
               p.parent_submission_feature_id
        FROM submission_feature p
        JOIN cart_ancestors ca ON p.submission_feature_id = ca.parent_submission_feature_id
      `,
          [cartId, CartStatus.ACTIVE]
        )
      )
      .with(
        'effectively_secured',
        knex.raw(`
        SELECT DISTINCT ca.cart_feature_id AS submission_feature_id
        FROM cart_ancestors ca
        INNER JOIN submission_feature_security sfs
          ON sfs.submission_feature_id = ca.ancestor_id
        WHERE sfs.record_end_date IS NULL
      `)
      )
      .select(
        'csf.cart_submission_feature_id',
        'sf.submission_feature_id',
        'sf.submission_id',
        'sf.feature_type_id',
        'ft.name as feature_type_name',
        knex.raw('CASE WHEN es.submission_feature_id IS NOT NULL THEN TRUE ELSE FALSE END AS secured')
      )
      .from('submission_feature as sf')
      .join('feature_type as ft', 'ft.feature_type_id', 'sf.feature_type_id')
      .join('cart_submission_feature as csf', 'csf.submission_feature_id', 'sf.submission_feature_id')
      .join('cart as c', 'c.cart_id', 'csf.cart_id')
      .leftJoin('effectively_secured as es', 'es.submission_feature_id', 'sf.submission_feature_id')
      .where('csf.cart_id', cartId)
      .andWhere('c.cart_status', CartStatus.ACTIVE);

    if (submissionFeatureId) {
      baseQuery.andWhere('sf.submission_feature_id', submissionFeatureId);
    }

    const paginatedQuery = this.applyPagination(baseQuery, pagination);

    const response = await this.connection.knex(paginatedQuery, CartSubmissionFeature);

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
