// Integration test for tile context creation — verifies expression persistence and dedup, the reuse
// window, the creation cap and its eviction, and expiry cleanup against the real database.
//
// Uses a transaction that is ROLLED BACK after each test, so no data is persisted.
//
// Run: make test-db
// Requires: make web (database must be running with seed data)

import { expect } from 'chai';
import sinon from 'sinon';
import SQL from 'sql-template-strings';
import { z } from 'zod';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { ExpressionTree } from '../../models/expression-tree';
import { MartinContextRepository } from '../../repositories/martin-context-repository';
import { ExpressionPredicateSemanticValidator } from '../../services/expression-predicate-semantic-validator';
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
    expect.fail(`no numeric property seeded for ${FEATURE_TYPE}; the filter tests need one to build an expression`);
  }

  return result.rows[0];
};

/**
 * Resolve the id of the feature type under test.
 *
 * @param {IDBConnection} connection
 * @return {*}  {Promise<number>}
 */
const resolveFeatureTypeId = async (connection: IDBConnection): Promise<number> => {
  const result = await connection.sql(
    SQL`SELECT feature_type_id FROM feature_type WHERE name = ${FEATURE_TYPE} AND record_end_date IS NULL;`,
    z.object({ feature_type_id: z.number() })
  );

  return result.rows[0].feature_type_id;
};

const storedContextSchema = z.object({
  expression_id: z.string().nullable(),
  system_user_id: z.number().nullable(),
  create_user: z.number()
});

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
    sinon.restore();
    await connection.rollback();
    connection.release();
    process.env = { ...originalEnv };
  });

  /**
   * Count the contexts currently stored.
   */
  const countContexts = async (): Promise<number> => {
    const result = await connection.sql(
      SQL`SELECT count(*)::integer AS total FROM martin_context;`,
      z.object({ total: z.number() })
    );

    return result.rows[0].total;
  };

  /**
   * Read the stored authorization state of a context.
   */
  const readContext = async (martinContextId: string) => {
    const stored = await connection.sql(
      SQL`
        SELECT expression_id, system_user_id, create_user
        FROM martin_context
        WHERE martin_context_id = ${martinContextId};
      `,
      storedContextSchema
    );

    return stored.rows[0];
  };

  /**
   * A filtered search. Varying `value` varies the normalized expression, so each distinct value is a
   * distinct search rather than a reuse.
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

  describe('creation', () => {
    it('creates a browse-all context, referencing no expression, for an unfiltered view', async () => {
      const result = await service.createOrReuseMartinContext(FEATURE_TYPE, undefined, null);

      expect(result.martinContextId).to.be.a('string');
      expect(result.expiresInSeconds).to.be.greaterThan(0);

      const stored = await readContext(result.martinContextId);

      // NULL expression is the only browse-all mechanism: the tile function then applies the
      // caller's authorization and the feature type, nothing else.
      expect(stored.expression_id).to.be.null;
      expect(stored.system_user_id).to.be.null;
      expect(stored.create_user).to.be.a('number');
    });

    it('validates the search once, and reuses that normalized tree to persist it', async () => {
      // Validation resolves property metadata from the database. The probe for secured results and
      // the write path both need the normalized tree, so validating per consumer would repeat those
      // reads on every mint.
      const validate = sinon.spy(ExpressionPredicateSemanticValidator.prototype, 'validateExpressionTree');

      await service.createOrReuseMartinContext(FEATURE_TYPE, filteredSearch(900103), null);

      expect(validate.callCount).to.equal(1);
    });

    it('persists the search expression and references it from the context', async () => {
      const result = await service.createOrReuseMartinContext(FEATURE_TYPE, filteredSearch(900101), null);

      const stored = await readContext(result.martinContextId);

      expect(stored.expression_id).to.be.a('string');

      // The referenced expression is a real persisted row, not a hash.
      const expression = await connection.sql(
        SQL`SELECT count(*)::integer AS total FROM expression WHERE expression_id = ${stored.expression_id} AND record_end_date IS NULL;`,
        z.object({ total: z.number() })
      );

      expect(expression.rows[0].total).to.equal(1);
    });

    it('resolves an identical search to one persisted expression', async () => {
      const first = await service.createOrReuseMartinContext(FEATURE_TYPE, filteredSearch(900102), null);

      // Same normalized search minted by a different identity: a distinct context, but the
      // persistence layer must dedupe the expression itself.
      const systemUserId = connection.systemUserId();
      const second = await service.createOrReuseMartinContext(FEATURE_TYPE, filteredSearch(900102), systemUserId ?? 1);

      const firstStored = await readContext(first.martinContextId);
      const secondStored = await readContext(second.martinContextId);

      expect(second.martinContextId).to.not.equal(first.martinContextId);
      expect(secondStored.expression_id).to.equal(firstStored.expression_id);
    });

    it('records the caller on the context', async () => {
      const systemUserId = connection.systemUserId();
      const result = await service.createOrReuseMartinContext(FEATURE_TYPE, undefined, systemUserId ?? 1);

      const stored = await readContext(result.martinContextId);

      expect(stored.system_user_id).to.equal(systemUserId ?? 1);
    });
  });

  describe('deduplication', () => {
    it('reuses a live context for an identical request', async () => {
      const first = await service.createOrReuseMartinContext(FEATURE_TYPE, undefined, null);
      const before = await countContexts();

      const second = await service.createOrReuseMartinContext(FEATURE_TYPE, undefined, null);
      const after = await countContexts();

      // Sharing one context is what lets every anonymous visitor share cached tiles.
      expect(second.martinContextId).to.equal(first.martinContextId);
      expect(after).to.equal(before);
    });

    it('does not reuse a context whose remaining life is shorter than a token', async () => {
      const first = await service.createOrReuseMartinContext(FEATURE_TYPE, undefined, null);

      // Leave it live, but with less life than a freshly minted token would have.
      await connection.sql(SQL`
        UPDATE martin_context
        SET record_end_date = now() + make_interval(secs => 30)
        WHERE martin_context_id = ${first.martinContextId};
      `);

      const second = await service.createOrReuseMartinContext(FEATURE_TYPE, undefined, null);

      // Reusing it would issue a 15 minute token against a context expiring in 30 seconds.
      expect(second.martinContextId).to.not.equal(first.martinContextId);
    });

    it('does not extend the expiry of a reused context', async () => {
      const first = await service.createOrReuseMartinContext(FEATURE_TYPE, undefined, null);

      const before = await connection.sql(
        SQL`SELECT record_end_date FROM martin_context WHERE martin_context_id = ${first.martinContextId};`,
        z.object({ record_end_date: z.any() })
      );

      await service.createOrReuseMartinContext(FEATURE_TYPE, undefined, null);

      const after = await connection.sql(
        SQL`SELECT record_end_date FROM martin_context WHERE martin_context_id = ${first.martinContextId};`,
        z.object({ record_end_date: z.any() })
      );

      expect(String(after.rows[0].record_end_date)).to.equal(String(before.rows[0].record_end_date));
    });

    it('does not share a context between an anonymous and an authenticated caller', async () => {
      const anonymous = await service.createOrReuseMartinContext(FEATURE_TYPE, undefined, null);

      // Authorization is evaluated per user at serve time, so identity is part of the dedup key.
      const systemUserId = connection.systemUserId();
      const authenticated = await service.createOrReuseMartinContext(FEATURE_TYPE, undefined, systemUserId ?? 1);

      expect(authenticated.martinContextId).to.not.equal(anonymous.martinContextId);

      const stored = await readContext(authenticated.martinContextId);

      expect(stored.system_user_id).to.equal(systemUserId ?? 1);
    });

    it('resolves two simultaneous identical mints to one context', async () => {
      // The reuse check and the insert are one logical step. Without serialization two callers
      // arriving together both read nothing — neither can see the other's uncommitted row — and both
      // insert, so Martin caches one search's tiles twice under two ids.
      //
      // Exercised at the repository, where that step lives: the service does several round trips
      // before reaching it, which makes the window this covers a matter of timing rather than a
      // property of the code. Two real connections, because two transactions on one connection
      // serialize regardless and would pass whatever the implementation does.
      const contextHash = 'integration-concurrent-mint';
      const featureTypeId = await resolveFeatureTypeId(connection);
      const newContext = {
        context_hash: contextHash,
        expression_id: null,
        feature_type_id: featureTypeId,
        system_user_id: null
      };

      const [connectionA, connectionB] = [getAPIUserDBConnection(), getAPIUserDBConnection()];

      await Promise.all([connectionA.open(), connectionB.open()]);

      try {
        // A creates and holds its transaction open, so its row is written but invisible to B.
        const first = await new MartinContextRepository(connectionA).ensureLiveContext(newContext, 900, 1800);

        expect(first.inserted).to.be.true;

        // B starts inside exactly that window, and must wait rather than insert alongside it.
        const secondPending = new MartinContextRepository(connectionB).ensureLiveContext(newContext, 900, 1800);

        await new Promise((resolve) => setTimeout(resolve, 250));

        await connectionA.commit();

        const second = await secondPending;

        await connectionB.commit();

        expect(second.inserted, 'the second caller must reuse rather than insert').to.be.false;
        expect(second.martin_context_id).to.equal(first.martin_context_id);

        const stored = await connection.sql(
          SQL`SELECT count(*)::integer AS total FROM martin_context WHERE context_hash = ${contextHash};`,
          z.object({ total: z.number() })
        );

        expect(stored.rows[0].total).to.equal(1);
      } finally {
        connectionA.release();
        connectionB.release();

        // These rows are committed, so they outlive the suite's rollback — and the suite connection
        // is rolled back, so deleting them through it would not stick either. Cleanup gets its own
        // committed transaction. Deleting by hash also clears the duplicate a regression leaves.
        const cleanupConnection = getAPIUserDBConnection();

        await cleanupConnection.open();
        await cleanupConnection.sql(SQL`DELETE FROM martin_context WHERE context_hash = ${contextHash};`);
        await cleanupConnection.commit();
        cleanupConnection.release();
      }
    });
  });

  describe('creation cap', () => {
    /**
     * Push every context the database already holds far into the future, so the eviction ordering
     * under test is only ever between the contexts this test creates. Rolled back with everything
     * else.
     */
    const isolateExistingContexts = async (): Promise<void> => {
      await connection.sql(SQL`UPDATE martin_context SET record_end_date = now() + make_interval(days => 1);`);
    };

    /** Force a context to be the next one evicted, by making it the closest to expiry. */
    const expireSoonest = async (martinContextId: string, seconds: number): Promise<void> => {
      await connection.sql(SQL`
        UPDATE martin_context
        SET record_end_date = now() + make_interval(secs => ${seconds})
        WHERE martin_context_id = ${martinContextId};
      `);
    };

    const countLive = async (): Promise<number> => {
      const result = await connection.sql(
        SQL`SELECT count(*)::integer AS live FROM martin_context WHERE record_end_date > now();`,
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

    /** Create a context for a distinct search. */
    const createFiltered = async (value: number): Promise<string> => {
      const result = await service.createOrReuseMartinContext(FEATURE_TYPE, filteredSearch(value), null);

      return result.martinContextId;
    };

    it('evicts the context closest to expiry rather than refusing the new search', async () => {
      await isolateExistingContexts();

      const oldest = await createFiltered(900001);
      const newer = await createFiltered(900002);

      // Deterministic ordering: `oldest` expires first, so it is the one the cap must claim.
      await expireSoonest(oldest, 60);
      await expireSoonest(newer, 600);

      // Sized so the next creation is exactly at the cap.
      process.env.MARTIN_CONTEXT_MAX_LIVE = String(await countLive());

      const created = await createFiltered(900003);

      // The point of the eviction design: a caller at the cap gets a working map. Refusing instead
      // would let anyone hold every slot and lock every other user out of new searches.
      expect(created).to.not.be.empty;
      expect(await contextExists(oldest), 'the context closest to expiry should have been evicted').to.be.false;
      expect(await contextExists(newer), 'only the closest to expiry should be evicted').to.be.true;
      expect(await countLive()).to.equal(Number(process.env.MARTIN_CONTEXT_MAX_LIVE));
    });

    it('reuses a live context at the cap instead of evicting to replace it', async () => {
      await isolateExistingContexts();

      const first = await createFiltered(900006);

      await expireSoonest(first, 900);
      process.env.MARTIN_CONTEXT_MAX_LIVE = String(await countLive());

      // The same search by the same identity resolves to the same hash, so it never reaches the cap
      // at all.
      const again = await service.createOrReuseMartinContext(FEATURE_TYPE, filteredSearch(900006), null);

      expect(again.martinContextId).to.equal(first);
      expect(await contextExists(first)).to.be.true;
    });

    it('never evicts the context it just created, even when it is the closest to expiry', async () => {
      // Park everything, create one more, park that too: every candidate now expires in a day,
      // so the NEW context (with a much shorter TTL) becomes the closest to expiry — the exact
      // case where "evict the closest to expiry" would otherwise pick itself and return a token
      // whose map can never load.
      await isolateExistingContexts();
      const other = await createFiltered(900009);
      await isolateExistingContexts();

      expect(other).to.not.be.empty;
      process.env.MARTIN_CONTEXT_MAX_LIVE = String(await countLive());

      const created = await createFiltered(900010);

      expect(await contextExists(created), 'the new context must never be its own victim').to.be.true;
      expect(await countLive()).to.equal(Number(process.env.MARTIN_CONTEXT_MAX_LIVE));
    });
  });

  describe('cleanup', () => {
    it('deletes expired contexts', async () => {
      const result = await service.createOrReuseMartinContext(FEATURE_TYPE, undefined, null);

      await connection.sql(SQL`
        UPDATE martin_context SET record_end_date = now() - make_interval(secs => 60)
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

      await service.deleteExpiredMartinContexts();

      const remaining = await connection.sql(
        SQL`SELECT count(*)::integer AS total FROM martin_context WHERE martin_context_id = ${result.martinContextId};`,
        z.object({ total: z.number() })
      );

      expect(remaining.rows[0].total).to.equal(1);
    });

    it('does not preserve an expired context for reuse', async () => {
      const first = await service.createOrReuseMartinContext(FEATURE_TYPE, undefined, null);

      await connection.sql(SQL`
        UPDATE martin_context SET record_end_date = now() - make_interval(secs => 60)
        WHERE martin_context_id = ${first.martinContextId};
      `);

      // The mint path opportunistically clears expired rows for its own hash, then creates fresh.
      const second = await service.createOrReuseMartinContext(FEATURE_TYPE, undefined, null);

      expect(second.martinContextId).to.not.equal(first.martinContextId);

      const remaining = await connection.sql(
        SQL`SELECT count(*)::integer AS total FROM martin_context WHERE martin_context_id = ${first.martinContextId};`,
        z.object({ total: z.number() })
      );

      expect(remaining.rows[0].total).to.equal(0);
    });
  });
});
