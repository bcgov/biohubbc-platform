import SQL from 'sql-template-strings';
import { CreateMartinContext, MartinContextWithExpiry } from '../models/martin-context';
import { BaseRepository } from './base-repository';

/**
 * Repository for tile context rows: the server-side authorization state behind a map Martin session.
 */
export class MartinContextRepository extends BaseRepository {
  /**
   * Find a live context that an identical request can reuse.
   *
   * Reuse is what makes tile caching effective: every caller with the same identity running the same
   * search shares one context, and therefore one set of cached tiles.
   *
   * A context is only reusable while it still has at least `minRemainingSeconds` of life, which the
   * caller sets to the token lifetime. Handing out a fresh token against a context due to expire
   * sooner would produce a session whose tiles die mid-use. The context's own expiry is never
   * extended.
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
        floor(extract(epoch FROM (record_end_date - now())))::integer AS expires_in_seconds
      FROM martin_context
      WHERE context_hash = ${contextHash}
        AND record_end_date >= now() + make_interval(secs => ${minRemainingSeconds})
      ORDER BY create_date DESC
      LIMIT 1;
    `;

    const response = await this.connection.sql(sqlStatement, MartinContextWithExpiry);

    return response.rows[0] ?? null;
  }

  /**
   * Insert a tile context.
   *
   * `create_user` comes from the connection's audit context (`api_get_context_user_id()`): the
   * searcher when the request is authenticated, the API service account for anonymous mints.
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
        expression_id,
        feature_type_id,
        system_user_id,
        record_end_date,
        create_user
      ) VALUES (
        ${context.context_hash},
        ${context.expression_id},
        ${context.feature_type_id},
        ${context.system_user_id},
        now() + make_interval(secs => ${ttlSeconds}),
        api_get_context_user_id()
      )
      RETURNING
        martin_context_id,
        floor(extract(epoch FROM (record_end_date - now())))::integer AS expires_in_seconds;
    `;

    const response = await this.connection.sql(sqlStatement, MartinContextWithExpiry);

    return response.rows[0];
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
      SQL`DELETE FROM martin_context WHERE context_hash = ${contextHash} AND record_end_date <= now();`
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
    const response = await this.connection.sql(SQL`DELETE FROM martin_context WHERE record_end_date <= now();`);

    return response.rowCount ?? 0;
  }

  /**
   * Enforce the live-context cap by evicting the contexts closest to expiry, never touching
   * `protectedContextId`.
   *
   * Bounds the database growth a caller can force by varying a search per mint (each mint may also
   * persist a new expression, but expressions deduplicate and end-date; context rows are the
   * unbounded part). Reused contexts never reach this: only new inserts do.
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
   * The record_end_date index (martin_context_idx2) serves both the liveness filter and the
   * ordering.
   *
   * @param {number} maxLiveContexts - Maximum live contexts to leave in place.
   * @param {string} protectedContextId - The just-created context; never evicted.
   * @return {Promise<number>} Contexts evicted.
   * @memberof MartinContextRepository
   */
  async enforceLiveContextCap(maxLiveContexts: number, protectedContextId: string): Promise<number> {
    const response = await this.connection.sql(SQL`
      WITH live AS (
        SELECT count(*) AS live_count
        FROM martin_context
        WHERE record_end_date > now()
      ),
      victims AS (
        SELECT martin_context_id
        FROM martin_context
        WHERE record_end_date > now()
          AND martin_context_id != ${protectedContextId}
        ORDER BY record_end_date ASC
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
