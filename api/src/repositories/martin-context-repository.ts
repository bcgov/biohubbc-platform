import { Knex } from 'knex';
import SQL from 'sql-template-strings';
import { z } from 'zod';
import { getKnex } from '../database/db';
import { CreateMartinContext, MartinContextWithExpiry } from '../models/martin-context';
import { BaseRepository } from './base-repository';

/** Extent columns returned by the bounding-box queries; each is null when the context has no geometry. */
const boundingBoxExtentSchema = z.object({
  min_x: z.number().nullable(),
  min_y: z.number().nullable(),
  max_x: z.number().nullable(),
  max_y: z.number().nullable()
});

/**
 * Reduce a bounding-box extent row to a `[minx, miny, maxx, maxy]` tuple, or null when the context
 * holds no mappable geometries (an empty extent).
 *
 * @param {(z.infer<typeof boundingBoxExtentSchema> | undefined)} row
 * @return {*}  {([number, number, number, number] | null)}
 */
const toBoundingBoxTuple = (
  row: z.infer<typeof boundingBoxExtentSchema> | undefined
): [number, number, number, number] | null => {
  if (!row || row.min_x === null || row.min_y === null || row.max_x === null || row.max_y === null) {
    return null;
  }

  return [row.min_x, row.min_y, row.max_x, row.max_y];
};

/**
 * Repository for tile context rows: the server-side authorization state behind a map Martin session.
 */
export class MartinContextRepository extends BaseRepository {
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
   * @return {Promise<MartinContextWithExpiry | null>}
   * @memberof MartinContextRepository
   */
  async findReusableLiveContext(
    contextHash: string,
    minRemainingSeconds: number
  ): Promise<MartinContextWithExpiry | null> {
    const sqlStatement = SQL`
      SELECT
        martin_context_id,
        is_materialized,
        floor(extract(epoch FROM (expires_at - now())))::integer AS expires_in_seconds
      FROM martin_context
      WHERE context_hash = ${contextHash}
        AND expires_at >= now() + make_interval(secs => ${minRemainingSeconds})
      ORDER BY create_date DESC
      LIMIT 1;
    `;

    const response = await this.connection.sql(sqlStatement, MartinContextWithExpiry);

    return response.rows[0] ?? null;
  }

  /**
   * Insert a tile context.
   *
   * @param {CreateMartinContext} context
   * @param {number} ttlSeconds
   * @return {Promise<MartinContextWithExpiry>}
   * @memberof MartinContextRepository
   */
  async insertMartinContext(context: CreateMartinContext, ttlSeconds: number): Promise<MartinContextWithExpiry> {
    const sqlStatement = SQL`
      INSERT INTO martin_context (
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
        martin_context_id,
        is_materialized,
        floor(extract(epoch FROM (expires_at - now())))::integer AS expires_in_seconds;
    `;

    const response = await this.connection.sql(sqlStatement, MartinContextWithExpiry);

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
   * @param {string} martinContextId
   * @param {Knex.QueryBuilder} featureIdsSubquery - Unexecuted, already security filtered.
   * @param {number} limit - Cap + 1.
   * @return {Promise<number>} Number of ids materialized.
   * @memberof MartinContextRepository
   */
  async materializeContextFeatures(
    martinContextId: string,
    featureIdsSubquery: Knex.QueryBuilder,
    limit: number
  ): Promise<number> {
    const knex = getKnex();

    const queryBuilder = knex
      .into(knex.raw('martin_context_feature (martin_context_id, submission_feature_id)'))
      .insert(
        knex
          .select(knex.raw('?::uuid', [martinContextId]), 'matches.submission_feature_id')
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
   * @param {string} martinContextId
   * @return {Promise<[number, number, number, number] | null>} [minx, miny, maxx, maxy], or null.
   * @memberof MartinContextRepository
   */
  async updateContextBoundingBox(martinContextId: string): Promise<[number, number, number, number] | null> {
    const sqlStatement = SQL`
      UPDATE martin_context
      SET bbox = (
        SELECT public.ST_Extent(g.value)
        FROM martin_context_feature tcf
        JOIN submission_feature_property_geometry g
          ON g.submission_feature_id = tcf.submission_feature_id
        WHERE tcf.martin_context_id = ${martinContextId}
      )
      WHERE martin_context_id = ${martinContextId}
      RETURNING
        public.ST_XMin(bbox) AS min_x,
        public.ST_YMin(bbox) AS min_y,
        public.ST_XMax(bbox) AS max_x,
        public.ST_YMax(bbox) AS max_y;
    `;

    const response = await this.connection.sql(sqlStatement, boundingBoxExtentSchema);

    return toBoundingBoxTuple(response.rows[0]);
  }

  /**
   * Read the stored extent of a context's materialized geometries.
   *
   * The extent is computed once, when the context is created (see {@link updateContextBoundingBox}),
   * and a context's materialized result set is frozen thereafter. A reused context therefore reads the
   * stored value back rather than recomputing it and rewriting the shared row.
   *
   * @param {string} martinContextId
   * @return {Promise<[number, number, number, number] | null>} [minx, miny, maxx, maxy], or null.
   * @memberof MartinContextRepository
   */
  async getContextBoundingBox(martinContextId: string): Promise<[number, number, number, number] | null> {
    const sqlStatement = SQL`
      SELECT
        public.ST_XMin(bbox) AS min_x,
        public.ST_YMin(bbox) AS min_y,
        public.ST_XMax(bbox) AS max_x,
        public.ST_YMax(bbox) AS max_y
      FROM martin_context
      WHERE martin_context_id = ${martinContextId};
    `;

    const response = await this.connection.sql(sqlStatement, boundingBoxExtentSchema);

    return toBoundingBoxTuple(response.rows[0]);
  }

  /**
   * Delete a tile context. Materialized ids cascade.
   *
   * @param {string} martinContextId
   * @return {Promise<void>}
   * @memberof MartinContextRepository
   */
  async deleteMartinContext(martinContextId: string): Promise<void> {
    await this.connection.sql(SQL`DELETE FROM martin_context WHERE martin_context_id = ${martinContextId};`);
  }

  /**
   * Delete expired contexts sharing a hash.
   *
   * Opportunistic cleanup on the mint path, so a repeatedly-run search does not accumulate dead rows
   * between sweeps.
   *
   * @param {string} contextHash
   * @return {Promise<number>} Rows deleted.
   * @memberof MartinContextRepository
   */
  async deleteExpiredContextsByHash(contextHash: string): Promise<number> {
    const response = await this.connection.sql(
      SQL`DELETE FROM martin_context WHERE context_hash = ${contextHash} AND expires_at <= now();`
    );

    return response.rowCount ?? 0;
  }

  /**
   * Delete every expired context.
   *
   * @return {Promise<number>} Rows deleted.
   * @memberof MartinContextRepository
   */
  async deleteExpiredContexts(): Promise<number> {
    const response = await this.connection.sql(SQL`DELETE FROM martin_context WHERE expires_at <= now();`);

    return response.rowCount ?? 0;
  }

  /**
   * Enforce the materialized-context cap by evicting the contexts closest to expiry, never touching
   * `protectedContextId`.
   *
   * Called AFTER the new context has been inserted and has passed the feature-cap check. The order
   * is the point: evicting first would let a search that is then refused for matching too many
   * features evict a live context and throw its own away — turning over-cap requests into a free
   * eviction attack that blanks one working map per request while never occupying a slot. Because
   * this runs after the insert, the count below includes the caller's own row, and the LIMIT brings
   * the total this transaction can see back down to exactly the cap.
   *
   * Only MATERIALIZED contexts are counted. A browse-all context is a single row with no
   * `martin_context_feature` behind it, so bounding those would cost availability and save nothing;
   * what this bounds is the materialization an anonymous caller can force by varying an expression
   * per request.
   *
   * Evicts rather than refuses. A global refusal is a denial of service handed to anyone willing to
   * spend one request per context: with a cap of N and a context lifetime of T, holding every slot
   * costs N/T requests per minute, and everyone else's new searches fail until the attacker stops.
   * Evicting the row closest to expiry instead means the cost lands on the least useful session, and
   * a caller whose context is evicted re-mints on its next refresh.
   *
   * The protected id is EXCLUDED from the victims rather than trusted to sort last. The new row
   * normally has the farthest expiry, but a TTL lowered between deploys can make it the closest —
   * and a mint that evicted its own context would return a token whose map can never load.
   *
   * ONE statement on purpose: counting and evicting separately leaves a window where two mints both
   * read a count below the cap. Concurrent mints cannot see each other's uncommitted inserts, so
   * simultaneous creations can still overshoot by the number in flight; each later mint sees the
   * surplus and evicts it, so the cap is self-correcting rather than merely approximate.
   *
   * SKIP LOCKED is load-bearing, not a nicety. This runs inside the mint's transaction, which holds
   * its locks until the handler commits. Without it, every concurrent mint at the cap picks the SAME
   * closest-to-expiry row and blocks on its lock for the remainder of the winner's transaction, so
   * mints serialize and the api's connection pool drains under exactly the load this cap exists to
   * survive. Skipping locked rows makes each mint claim a different victim and return immediately.
   * Rows are locked as they are fetched and skipped rows do not count against the LIMIT, so each
   * caller still evicts as many as it needs.
   *
   * Deleted contexts cascade to `martin_context_feature` (martin_context_feature_fk1), and the
   * expires_at index (martin_context_idx2) serves both the liveness filter and the ordering.
   *
   * @param {number} maxLiveContexts - Maximum live materialized contexts to leave in place.
   * @param {string} protectedContextId - The just-created context; never evicted.
   * @return {Promise<number>} Contexts evicted.
   * @memberof MartinContextRepository
   */
  async enforceMaterializedContextCap(maxLiveContexts: number, protectedContextId: string): Promise<number> {
    const response = await this.connection.sql(SQL`
      WITH live AS (
        SELECT count(*) AS live_count
        FROM martin_context
        WHERE expires_at > now()
          AND is_materialized
      ),
      victims AS (
        SELECT martin_context_id
        FROM martin_context
        WHERE expires_at > now()
          AND is_materialized
          AND martin_context_id != ${protectedContextId}
        ORDER BY expires_at ASC
        LIMIT greatest((SELECT live_count FROM live) - ${maxLiveContexts}, 0)
        -- Counting and locking must be separate scopes: FOR UPDATE is not allowed alongside a
        -- window function, which is why the count is its own CTE rather than a count(*) OVER ().
        FOR UPDATE SKIP LOCKED
      )
      DELETE FROM martin_context
      WHERE martin_context_id IN (SELECT martin_context_id FROM victims);
    `);

    return response.rowCount ?? 0;
  }
}
