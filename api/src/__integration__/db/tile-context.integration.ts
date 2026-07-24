// Integration test for tile context creation — verifies dedup, the reuse window, the creation cap
// and its eviction, materialization and expiry cleanup against the real database.
//
// Uses a transaction that is ROLLED BACK after each test, so no data is persisted.
//
// Run: make test-db
// Requires: make web (database must be running with seed data)

import { expect } from 'chai';
import SQL from 'sql-template-strings';
import { z } from 'zod';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { HTTP503 } from '../../errors/http-error';
import { ExpressionTree } from '../../models/expression-tree';
import { MartinContextService } from '../../services/martin-context-service';

const FEATURE_TYPE = 'species_observation';

/** Identifiers of a feature property, as an expression predicate has to name both. */
interface PropertyIds {
  feature_property_id: number;
  feature_type_property_id: number;
}

/**
 * Resolve a numeric property of the feature type under test, for building filter expressions.
 *
 * Looked up rather than hardcoded: the ids come from reference seed data and are not stable across
 * environments.
 *
 * @param {IDBConnection} connection
 * @return {*}  {Promise<PropertyIds>}
 */
const resolveNumericProperty = async (connection: IDBConnection): Promise<PropertyIds> => {
  const result = await connection.sql(
    SQL`
      SELECT fp.feature_property_id, ftp.feature_type_property_id
      FROM feature_type ft
      JOIN feature_type_property ftp
        ON ftp.feature_type_id = ft.feature_type_id
        AND ftp.record_end_date IS NULL
      JOIN feature_property fp
        ON fp.feature_property_id = ftp.feature_property_id
        AND fp.record_end_date IS NULL
      JOIN feature_property_type fpt
        ON fpt.feature_property_type_id = fp.feature_property_type_id
      WHERE ft.name = ${FEATURE_TYPE}
        AND fpt.name = 'number'
      ORDER BY fp.feature_property_id
      LIMIT 1;
    `,
    z.object({ feature_property_id: z.number(), feature_type_property_id: z.number() })
  );

  if (!result.rows.length) {
    expect.fail(`no numeric property seeded for ${FEATURE_TYPE}; the cap tests need one to build a filter`);
  }

  return result.rows[0];
};

describe('Tile context (integration)', function () {
  this.timeout(20000);

  let connection: IDBConnection;
  let service: MartinContextService;
  let countProperty: PropertyIds;

  const originalEnv = { ...process.env };

  before(() => {
    initDBPool(defaultPoolConfig);
  });

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    service = new MartinContextService(connection);
    countProperty = await resolveNumericProperty(connection);
  });

  afterEach(async () => {
    await connection.rollback();
    connection.release();
    process.env = { ...originalEnv };
  });

  /**
   * Count the contexts currently stored for a hash.
   */
  const countContexts = async (): Promise<number> => {
    const result = await connection.sql(
      SQL`SELECT count(*)::integer AS total FROM martin_context;`,
      z.object({ total: z.number() })
    );

    return result.rows[0].total;
  };

  describe('creation', () => {
    it('creates a rule-based context for an unfiltered view', async () => {
      const result = await service.createOrReuseMartinContext(FEATURE_TYPE, undefined, null);

      expect(result.overCap).to.be.false;

      if (result.overCap) {
        return;
      }

      expect(result.martinContextId).to.be.a('string');
      expect(result.expiresInSeconds).to.be.greaterThan(0);
      // An unfiltered view is never materialized: it would snapshot the whole feature type.
      expect(result.featureCount).to.be.null;

      const stored = await connection.sql(
        SQL`SELECT access_class, is_materialized, expression_hash FROM martin_context WHERE martin_context_id = ${result.martinContextId};`,
        z.object({
          access_class: z.string(),
          is_materialized: z.boolean(),
          expression_hash: z.string().nullable()
        })
      );

      expect(stored.rows[0].access_class).to.equal('anon');
      expect(stored.rows[0].is_materialized).to.be.false;
      expect(stored.rows[0].expression_hash).to.be.null;
    });

    it('records an anonymous caller as the anon access class with no scopes', async () => {
      const result = await service.createOrReuseMartinContext(FEATURE_TYPE, undefined, null);

      if (result.overCap) {
        expect.fail('expected a context');
      }

      const stored = await connection.sql(
        SQL`SELECT access_class, security_scope_ids FROM martin_context WHERE martin_context_id = ${result.martinContextId};`,
        z.object({ access_class: z.string(), security_scope_ids: z.array(z.string()) })
      );

      expect(stored.rows[0].access_class).to.equal('anon');
      expect(stored.rows[0].security_scope_ids).to.eql([]);
    });
  });

  describe('deduplication', () => {
    it('reuses a live context for an identical request', async () => {
      const first = await service.createOrReuseMartinContext(FEATURE_TYPE, undefined, null);
      const before = await countContexts();

      const second = await service.createOrReuseMartinContext(FEATURE_TYPE, undefined, null);
      const after = await countContexts();

      if (first.overCap || second.overCap) {
        expect.fail('expected contexts');
      }

      // Sharing one context is what lets every anonymous visitor share cached tiles.
      expect(second.martinContextId).to.equal(first.martinContextId);
      expect(after).to.equal(before);
    });

    it('does not reuse a context whose remaining life is shorter than a token', async () => {
      const first = await service.createOrReuseMartinContext(FEATURE_TYPE, undefined, null);

      if (first.overCap) {
        expect.fail('expected a context');
      }

      // Leave it live, but with less life than a freshly minted token would have.
      await connection.sql(SQL`
        UPDATE martin_context
        SET expires_at = now() + make_interval(secs => 30)
        WHERE martin_context_id = ${first.martinContextId};
      `);

      const second = await service.createOrReuseMartinContext(FEATURE_TYPE, undefined, null);

      if (second.overCap) {
        expect.fail('expected a context');
      }

      // Reusing it would issue a 15 minute token against a context expiring in 30 seconds.
      expect(second.martinContextId).to.not.equal(first.martinContextId);
    });

    it('does not extend the expiry of a reused context', async () => {
      const first = await service.createOrReuseMartinContext(FEATURE_TYPE, undefined, null);

      if (first.overCap) {
        expect.fail('expected a context');
      }

      const before = await connection.sql(
        SQL`SELECT expires_at FROM martin_context WHERE martin_context_id = ${first.martinContextId};`,
        z.object({ expires_at: z.any() })
      );

      await service.createOrReuseMartinContext(FEATURE_TYPE, undefined, null);

      const after = await connection.sql(
        SQL`SELECT expires_at FROM martin_context WHERE martin_context_id = ${first.martinContextId};`,
        z.object({ expires_at: z.any() })
      );

      // The materialized result set is frozen at creation, so extending the expiry would let a
      // popular search serve stale results indefinitely.
      expect(String(after.rows[0].expires_at)).to.equal(String(before.rows[0].expires_at));
    });

    it('does not share a context between different access classes', async () => {
      const anonymous = await service.createOrReuseMartinContext(FEATURE_TYPE, undefined, null);

      // A system user id makes this 'scoped', which must hash to a different context.
      const systemUserId = connection.systemUserId();
      const scoped = await service.createOrReuseMartinContext(FEATURE_TYPE, undefined, systemUserId ?? 1);

      if (anonymous.overCap || scoped.overCap) {
        expect.fail('expected contexts');
      }

      expect(scoped.martinContextId).to.not.equal(anonymous.martinContextId);

      const stored = await connection.sql(
        SQL`SELECT access_class FROM martin_context WHERE martin_context_id = ${scoped.martinContextId};`,
        z.object({ access_class: z.string() })
      );

      expect(stored.rows[0].access_class).to.equal('scoped');
    });
  });

  describe('creation cap', () => {
    /**
     * A filtered search, which is what produces a MATERIALIZED context. Varying `value` varies the
     * expression hash, so each call is a distinct search rather than a reuse. The threshold matches
     * nothing, which keeps materialization cheap without changing what is under test: whether a
     * context is materialized depends on the presence of an expression, not on its result count.
     */
    const filteredSearch = (value: number): ExpressionTree => ({
      type: 'expression',
      operator: 'AND',
      clauses: [
        {
          type: 'predicate',
          feature_property_id: countProperty.feature_property_id,
          feature_type_property_id: countProperty.feature_type_property_id,
          operator: 'GreaterThanOrEqual',
          value
        }
      ]
    });

    /**
     * Push every context the database already holds far into the future, so the eviction ordering
     * under test is only ever between the contexts this test creates. Rolled back with everything
     * else.
     */
    const isolateExistingContexts = async (): Promise<void> => {
      await connection.sql(SQL`UPDATE martin_context SET expires_at = now() + make_interval(days => 1);`);
    };

    /** Force a context to be the next one evicted, by making it the closest to expiry. */
    const expireSoonest = async (martinContextId: string, seconds: number): Promise<void> => {
      await connection.sql(SQL`
        UPDATE martin_context
        SET expires_at = now() + make_interval(secs => ${seconds})
        WHERE martin_context_id = ${martinContextId};
      `);
    };

    const countLiveMaterialized = async (): Promise<number> => {
      const result = await connection.sql(
        SQL`SELECT count(*)::integer AS live FROM martin_context WHERE expires_at > now() AND is_materialized;`,
        z.object({ live: z.number() })
      );

      return result.rows[0].live;
    };

    const contextExists = async (martinContextId: string): Promise<boolean> => {
      const result = await connection.sql(
        SQL`SELECT count(*)::integer AS total FROM martin_context WHERE martin_context_id = ${martinContextId};`,
        z.object({ total: z.number() })
      );

      return result.rows[0].total > 0;
    };

    /** Create a materialized context for a distinct search, failing loudly if it was refused. */
    const createMaterialized = async (value: number): Promise<string> => {
      const result = await service.createOrReuseMartinContext(FEATURE_TYPE, filteredSearch(value), null);

      if (result.overCap) {
        expect.fail('expected a context, not an over-cap refusal');
      }

      return result.martinContextId;
    };

    it('evicts the context closest to expiry rather than refusing the new search', async () => {
      await isolateExistingContexts();

      const oldest = await createMaterialized(900001);
      const newer = await createMaterialized(900002);

      // Deterministic ordering: `oldest` expires first, so it is the one the cap must claim.
      await expireSoonest(oldest, 60);
      await expireSoonest(newer, 600);

      // Sized so the next creation is exactly at the cap.
      process.env.MARTIN_CONTEXT_MAX_LIVE = String(await countLiveMaterialized());

      const created = await createMaterialized(900003);

      // The point of the change: a caller at the cap gets a working map. Refusing instead would let
      // anyone hold every slot and lock every other user out of new searches.
      expect(created).to.not.be.empty;
      expect(await contextExists(oldest), 'the context closest to expiry should have been evicted').to.be.false;
      expect(await contextExists(newer), 'only the closest to expiry should be evicted').to.be.true;
      expect(await countLiveMaterialized()).to.equal(Number(process.env.MARTIN_CONTEXT_MAX_LIVE));
    });

    it('drops the evicted context materialized feature ids with it', async () => {
      await isolateExistingContexts();

      // A predicate that actually matches, so there are rows to cascade.
      const evicted = await service.createOrReuseMartinContext(FEATURE_TYPE, filteredSearch(0), null);

      if (evicted.overCap) {
        expect.fail('expected a context');
      }

      const materializedIds = await connection.sql(
        SQL`SELECT count(*)::integer AS total FROM martin_context_feature WHERE martin_context_id = ${evicted.martinContextId};`,
        z.object({ total: z.number() })
      );

      expect(materializedIds.rows[0].total, 'the fixture needs a search that matches something').to.be.greaterThan(0);

      await expireSoonest(evicted.martinContextId, 60);
      process.env.MARTIN_CONTEXT_MAX_LIVE = String(await countLiveMaterialized());

      await createMaterialized(900004);

      const remaining = await connection.sql(
        SQL`SELECT count(*)::integer AS total FROM martin_context_feature WHERE martin_context_id = ${evicted.martinContextId};`,
        z.object({ total: z.number() })
      );

      // Reclaiming the rows is the whole point of the cap; leaving them would bound nothing.
      expect(remaining.rows[0].total).to.equal(0);
    });

    it('never caps an unfiltered search, which materializes nothing', async () => {
      await isolateExistingContexts();

      const materialized = await createMaterialized(900005);

      await expireSoonest(materialized, 60);
      // Already at the cap, with no headroom at all.
      process.env.MARTIN_CONTEXT_MAX_LIVE = String(await countLiveMaterialized());

      // A browse-all context is one row with no materialized ids behind it, so capping it would cost
      // availability and save nothing.
      const browseAll = await service.createOrReuseMartinContext(FEATURE_TYPE, undefined, null);

      if (browseAll.overCap) {
        expect.fail('expected a context');
      }

      expect(await contextExists(materialized), 'an unfiltered search must not evict anything').to.be.true;
    });

    it('reuses a live context at the cap instead of evicting to replace it', async () => {
      await isolateExistingContexts();

      const first = await createMaterialized(900006);

      await expireSoonest(first, 900);
      process.env.MARTIN_CONTEXT_MAX_LIVE = String(await countLiveMaterialized());

      // The same search resolves to the same hash, so it never reaches the cap at all.
      const again = await service.createOrReuseMartinContext(FEATURE_TYPE, filteredSearch(900006), null);

      if (again.overCap) {
        expect.fail('expected a context');
      }

      expect(again.martinContextId).to.equal(first);
      expect(await contextExists(first)).to.be.true;
    });

    it('refuses only when the cap is misconfigured below one, leaving nothing to evict into', async () => {
      process.env.MARTIN_CONTEXT_MAX_LIVE = '-1';

      try {
        await service.createOrReuseMartinContext(FEATURE_TYPE, filteredSearch(900007), null);
        expect.fail('expected a cap below one to be refused');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP503);
      }
    });

    it('never evicts for a search too large to map', async () => {
      await isolateExistingContexts();

      const victim = await createMaterialized(900008);

      await expireSoonest(victim, 60);
      process.env.MARTIN_CONTEXT_MAX_LIVE = String(await countLiveMaterialized());
      // Any real search now matches more features than may be mapped.
      process.env.MARTIN_CONTEXT_MAX_FEATURES = '1';

      // Eviction must come AFTER the over-cap refusal. In the other order, a refused search would
      // still evict a live context and then discard its own — a free eviction per request for an
      // attacker who never even occupies a slot.
      const refused = await service.createOrReuseMartinContext(FEATURE_TYPE, filteredSearch(0), null);

      expect(refused.overCap).to.be.true;
      expect(await contextExists(victim), 'a refused search must not evict anyone').to.be.true;
      expect(await countLiveMaterialized()).to.equal(Number(process.env.MARTIN_CONTEXT_MAX_LIVE));
    });

    it('never evicts the context it just created, even when it is the closest to expiry', async () => {
      // Park everything, create one more, park that too: every candidate now expires in a day,
      // so the NEW context (with a much shorter TTL) becomes the closest to expiry — the exact
      // case where "evict the closest to expiry" would otherwise pick itself and return a token
      // whose map can never load.
      await isolateExistingContexts();
      const other = await createMaterialized(900009);
      await isolateExistingContexts();

      expect(other).to.not.be.empty;
      process.env.MARTIN_CONTEXT_MAX_LIVE = String(await countLiveMaterialized());

      const created = await createMaterialized(900010);

      expect(await contextExists(created), 'the new context must never be its own victim').to.be.true;
      expect(await countLiveMaterialized()).to.equal(Number(process.env.MARTIN_CONTEXT_MAX_LIVE));
    });
  });

  describe('cleanup', () => {
    it('deletes expired contexts and cascades their materialized ids', async () => {
      const result = await service.createOrReuseMartinContext(FEATURE_TYPE, undefined, null);

      if (result.overCap) {
        expect.fail('expected a context');
      }

      await connection.sql(SQL`
        UPDATE martin_context SET expires_at = now() - make_interval(secs => 60)
        WHERE martin_context_id = ${result.martinContextId};
      `);

      const deleted = await service.deleteExpiredMartinContexts();

      expect(deleted).to.be.greaterThan(0);

      const remaining = await connection.sql(
        SQL`SELECT count(*)::integer AS total FROM martin_context WHERE martin_context_id = ${result.martinContextId};`,
        z.object({ total: z.number() })
      );

      expect(remaining.rows[0].total).to.equal(0);
    });

    it('leaves live contexts alone', async () => {
      const result = await service.createOrReuseMartinContext(FEATURE_TYPE, undefined, null);

      if (result.overCap) {
        expect.fail('expected a context');
      }

      await service.deleteExpiredMartinContexts();

      const remaining = await connection.sql(
        SQL`SELECT count(*)::integer AS total FROM martin_context WHERE martin_context_id = ${result.martinContextId};`,
        z.object({ total: z.number() })
      );

      expect(remaining.rows[0].total).to.equal(1);
    });
  });
});
