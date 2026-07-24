import { Knex } from 'knex';
import SQL from 'sql-template-strings';
import { z } from 'zod';
import { getKnex } from '../database/db';
import { CreateTileContext, TileContextWithExpiry } from '../models/tile-context';
import { BaseRepository } from './base-repository';

/**
 * Repository for tile context rows: the server-side authorization state behind a map tile session.
 */
export class TileContextRepository extends BaseRepository {
  /**
   * Find a live context that an identical request can reuse.
   *
   * Reuse is what makes tile caching effective: every anonymous visitor running the same search
   * shares one context, and therefore one set of cached tiles.
   *
   * A context is only reusable while it still has at least `minRemainingSeconds` of life, which the
   * caller sets to the token lifetime. Handing out a fresh token against a context due to expire
   * sooner would produce a session whose tiles die mid-use. The context's own expiry is never
   * extended: its materialized result set is frozen at creation, so extending it would let a popular
   * search serve stale results indefinitely.
   *
   * @param {string} contextHash
   * @param {number} minRemainingSeconds
   * @return {Promise<TileContextWithExpiry | null>}
   * @memberof TileContextRepository
   */
  async findReusableLiveContext(
    contextHash: string,
    minRemainingSeconds: number
  ): Promise<TileContextWithExpiry | null> {
    const sqlStatement = SQL`
      SELECT
        tile_context_id,
        is_materialized,
        floor(extract(epoch FROM (expires_at - now())))::integer AS expires_in_seconds
      FROM tile_context
      WHERE context_hash = ${contextHash}
        AND expires_at >= now() + make_interval(secs => ${minRemainingSeconds})
      ORDER BY create_date DESC
      LIMIT 1;
    `;

    const response = await this.connection.sql(sqlStatement, TileContextWithExpiry);

    return response.rows[0] ?? null;
  }

  /**
   * Insert a tile context.
   *
   * @param {CreateTileContext} context
   * @param {number} ttlSeconds
   * @return {Promise<TileContextWithExpiry>}
   * @memberof TileContextRepository
   */
  async insertTileContext(context: CreateTileContext, ttlSeconds: number): Promise<TileContextWithExpiry> {
    const sqlStatement = SQL`
      INSERT INTO tile_context (
        context_hash,
        access_class,
        feature_type_id,
        security_scope_ids,
        expression_hash,
        is_materialized,
        expires_at
      ) VALUES (
        ${context.context_hash},
        ${context.access_class},
        ${context.feature_type_id},
        ${context.security_scope_ids}::uuid[],
        ${context.expression_hash},
        ${context.is_materialized},
        now() + make_interval(secs => ${ttlSeconds})
      )
      RETURNING
        tile_context_id,
        is_materialized,
        floor(extract(epoch FROM (expires_at - now())))::integer AS expires_in_seconds;
    `;

    const response = await this.connection.sql(sqlStatement, TileContextWithExpiry);

    return response.rows[0];
  }

  /**
   * Materialize the search results for a context.
   *
   * Takes the unexecuted feature-id subquery the search evaluator builds, so the map resolves its
   * result set through exactly the same SQL the table view uses.
   *
   * Reads one row beyond the cap so the caller can tell "at the limit" from "over it" without
   * counting the whole result set first.
   *
   * @param {string} tileContextId
   * @param {Knex.QueryBuilder} featureIdsSubquery - Unexecuted, already security filtered.
   * @param {number} limit - Cap + 1.
   * @return {Promise<number>} Number of ids materialized.
   * @memberof TileContextRepository
   */
  async materializeContextFeatures(
    tileContextId: string,
    featureIdsSubquery: Knex.QueryBuilder,
    limit: number
  ): Promise<number> {
    const knex = getKnex();

    const queryBuilder = knex
      .into(knex.raw('tile_context_feature (tile_context_id, submission_feature_id)'))
      .insert(
        knex
          .select(knex.raw('?::uuid', [tileContextId]), 'matches.submission_feature_id')
          .from(featureIdsSubquery.clone().limit(limit).as('matches'))
      );

    const response = await this.connection.knex(queryBuilder);

    return response.rowCount ?? 0;
  }

  /**
   * Compute and store the extent of a context's materialized geometries.
   *
   * Stored rather than recomputed so a reused context returns it for free.
   *
   * @param {string} tileContextId
   * @return {Promise<[number, number, number, number] | null>} [minx, miny, maxx, maxy], or null.
   * @memberof TileContextRepository
   */
  async updateContextBoundingBox(tileContextId: string): Promise<[number, number, number, number] | null> {
    const sqlStatement = SQL`
      UPDATE tile_context
      SET bbox = (
        SELECT public.ST_Extent(g.value)
        FROM tile_context_feature tcf
        JOIN submission_feature_property_geometry g
          ON g.submission_feature_id = tcf.submission_feature_id
        WHERE tcf.tile_context_id = ${tileContextId}
      )
      WHERE tile_context_id = ${tileContextId}
      RETURNING
        public.ST_XMin(bbox) AS min_x,
        public.ST_YMin(bbox) AS min_y,
        public.ST_XMax(bbox) AS max_x,
        public.ST_YMax(bbox) AS max_y;
    `;

    const response = await this.connection.sql(
      sqlStatement,
      z.object({
        min_x: z.number().nullable(),
        min_y: z.number().nullable(),
        max_x: z.number().nullable(),
        max_y: z.number().nullable()
      })
    );

    const row = response.rows[0];

    if (!row || row.min_x === null || row.min_y === null || row.max_x === null || row.max_y === null) {
      return null;
    }

    return [row.min_x, row.min_y, row.max_x, row.max_y];
  }

  /**
   * Delete a tile context. Materialized ids cascade.
   *
   * @param {string} tileContextId
   * @return {Promise<void>}
   * @memberof TileContextRepository
   */
  async deleteTileContext(tileContextId: string): Promise<void> {
    await this.connection.sql(SQL`DELETE FROM tile_context WHERE tile_context_id = ${tileContextId};`);
  }

  /**
   * Delete expired contexts sharing a hash.
   *
   * Opportunistic cleanup on the mint path, so a repeatedly-run search does not accumulate dead rows
   * between sweeps.
   *
   * @param {string} contextHash
   * @return {Promise<number>} Rows deleted.
   * @memberof TileContextRepository
   */
  async deleteExpiredContextsByHash(contextHash: string): Promise<number> {
    const response = await this.connection.sql(
      SQL`DELETE FROM tile_context WHERE context_hash = ${contextHash} AND expires_at <= now();`
    );

    return response.rowCount ?? 0;
  }

  /**
   * Delete every expired context.
   *
   * @return {Promise<number>} Rows deleted.
   * @memberof TileContextRepository
   */
  async deleteExpiredContexts(): Promise<number> {
    const response = await this.connection.sql(SQL`DELETE FROM tile_context WHERE expires_at <= now();`);

    return response.rowCount ?? 0;
  }
}
