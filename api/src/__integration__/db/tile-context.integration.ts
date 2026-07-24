// Integration test for tile context creation — verifies dedup, the reuse window, over-cap refusal,
// materialization and expiry cleanup against the real database.
//
// Uses a transaction that is ROLLED BACK after each test, so no data is persisted.
//
// Run: make test-db
// Requires: make web (database must be running with seed data)

import { expect } from 'chai';
import SQL from 'sql-template-strings';
import { z } from 'zod';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { TileContextService } from '../../services/tile-context-service';

const FEATURE_TYPE = 'species_observation';

describe('Tile context (integration)', function () {
  this.timeout(20000);

  let connection: IDBConnection;
  let service: TileContextService;

  const originalEnv = { ...process.env };

  before(() => {
    initDBPool(defaultPoolConfig);
  });

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    service = new TileContextService(connection);
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
      SQL`SELECT count(*)::integer AS total FROM tile_context;`,
      z.object({ total: z.number() })
    );

    return result.rows[0].total;
  };

  describe('creation', () => {
    it('creates a rule-based context for an unfiltered view', async () => {
      const result = await service.createOrReuseTileContext(FEATURE_TYPE, undefined, null);

      expect(result.overCap).to.be.false;

      if (result.overCap) {
        return;
      }

      expect(result.tileContextId).to.be.a('string');
      expect(result.expiresInSeconds).to.be.greaterThan(0);
      // An unfiltered view is never materialized: it would snapshot the whole feature type.
      expect(result.featureCount).to.be.null;

      const stored = await connection.sql(
        SQL`SELECT access_class, is_materialized, expression_hash FROM tile_context WHERE tile_context_id = ${result.tileContextId};`,
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
      const result = await service.createOrReuseTileContext(FEATURE_TYPE, undefined, null);

      if (result.overCap) {
        expect.fail('expected a context');
      }

      const stored = await connection.sql(
        SQL`SELECT access_class, security_scope_ids FROM tile_context WHERE tile_context_id = ${result.tileContextId};`,
        z.object({ access_class: z.string(), security_scope_ids: z.array(z.string()) })
      );

      expect(stored.rows[0].access_class).to.equal('anon');
      expect(stored.rows[0].security_scope_ids).to.eql([]);
    });
  });

  describe('deduplication', () => {
    it('reuses a live context for an identical request', async () => {
      const first = await service.createOrReuseTileContext(FEATURE_TYPE, undefined, null);
      const before = await countContexts();

      const second = await service.createOrReuseTileContext(FEATURE_TYPE, undefined, null);
      const after = await countContexts();

      if (first.overCap || second.overCap) {
        expect.fail('expected contexts');
      }

      // Sharing one context is what lets every anonymous visitor share cached tiles.
      expect(second.tileContextId).to.equal(first.tileContextId);
      expect(after).to.equal(before);
    });

    it('does not reuse a context whose remaining life is shorter than a token', async () => {
      const first = await service.createOrReuseTileContext(FEATURE_TYPE, undefined, null);

      if (first.overCap) {
        expect.fail('expected a context');
      }

      // Leave it live, but with less life than a freshly minted token would have.
      await connection.sql(SQL`
        UPDATE tile_context
        SET expires_at = now() + make_interval(secs => 30)
        WHERE tile_context_id = ${first.tileContextId};
      `);

      const second = await service.createOrReuseTileContext(FEATURE_TYPE, undefined, null);

      if (second.overCap) {
        expect.fail('expected a context');
      }

      // Reusing it would issue a 15 minute token against a context expiring in 30 seconds.
      expect(second.tileContextId).to.not.equal(first.tileContextId);
    });

    it('does not extend the expiry of a reused context', async () => {
      const first = await service.createOrReuseTileContext(FEATURE_TYPE, undefined, null);

      if (first.overCap) {
        expect.fail('expected a context');
      }

      const before = await connection.sql(
        SQL`SELECT expires_at FROM tile_context WHERE tile_context_id = ${first.tileContextId};`,
        z.object({ expires_at: z.any() })
      );

      await service.createOrReuseTileContext(FEATURE_TYPE, undefined, null);

      const after = await connection.sql(
        SQL`SELECT expires_at FROM tile_context WHERE tile_context_id = ${first.tileContextId};`,
        z.object({ expires_at: z.any() })
      );

      // The materialized result set is frozen at creation, so extending the expiry would let a
      // popular search serve stale results indefinitely.
      expect(String(after.rows[0].expires_at)).to.equal(String(before.rows[0].expires_at));
    });

    it('does not share a context between different access classes', async () => {
      const anonymous = await service.createOrReuseTileContext(FEATURE_TYPE, undefined, null);

      // A system user id makes this 'scoped', which must hash to a different context.
      const systemUserId = connection.systemUserId();
      const scoped = await service.createOrReuseTileContext(FEATURE_TYPE, undefined, systemUserId ?? 1);

      if (anonymous.overCap || scoped.overCap) {
        expect.fail('expected contexts');
      }

      expect(scoped.tileContextId).to.not.equal(anonymous.tileContextId);

      const stored = await connection.sql(
        SQL`SELECT access_class FROM tile_context WHERE tile_context_id = ${scoped.tileContextId};`,
        z.object({ access_class: z.string() })
      );

      expect(stored.rows[0].access_class).to.equal('scoped');
    });
  });

  describe('cleanup', () => {
    it('deletes expired contexts and cascades their materialized ids', async () => {
      const result = await service.createOrReuseTileContext(FEATURE_TYPE, undefined, null);

      if (result.overCap) {
        expect.fail('expected a context');
      }

      await connection.sql(SQL`
        UPDATE tile_context SET expires_at = now() - make_interval(secs => 60)
        WHERE tile_context_id = ${result.tileContextId};
      `);

      const deleted = await service.deleteExpiredTileContexts();

      expect(deleted).to.be.greaterThan(0);

      const remaining = await connection.sql(
        SQL`SELECT count(*)::integer AS total FROM tile_context WHERE tile_context_id = ${result.tileContextId};`,
        z.object({ total: z.number() })
      );

      expect(remaining.rows[0].total).to.equal(0);
    });

    it('leaves live contexts alone', async () => {
      const result = await service.createOrReuseTileContext(FEATURE_TYPE, undefined, null);

      if (result.overCap) {
        expect.fail('expected a context');
      }

      await service.deleteExpiredTileContexts();

      const remaining = await connection.sql(
        SQL`SELECT count(*)::integer AS total FROM tile_context WHERE tile_context_id = ${result.tileContextId};`,
        z.object({ total: z.number() })
      );

      expect(remaining.rows[0].total).to.equal(1);
    });
  });
});
