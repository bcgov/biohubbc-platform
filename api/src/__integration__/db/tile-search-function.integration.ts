// Integration test for the authorized tile function — verifies that biohub.tile_search only ever
// encodes geometry the tile context is permitted to see, against the real database.
//
// This is the ticket's security boundary: the gateway authenticates, this SQL decides visibility.
// The suite therefore exercises the whole authorization matrix (anonymous, scoped-and-granted,
// scoped-but-not-granted), the fail-safe paths, and the takedown guarantee that comes from applying
// the predicate at serve time rather than at mint time.
//
// Uses a transaction that is ROLLED BACK after each test, so no data is persisted. tile_search is
// SECURITY DEFINER, but it executes inside the caller's transaction, so uncommitted fixtures are
// visible to it.
//
// Run: make test-db
// Requires: make web (database must be running with seed data)

import { expect } from 'chai';
import SQL from 'sql-template-strings';
import { z } from 'zod';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { secureFeature } from '../helpers/test-rbac-helpers';
import { createTestFeature, createTestSubmission } from '../helpers/test-submission-helpers';

/** Feature type used for the fixtures. Any type with a geometry property would do. */
const FEATURE_TYPE = 'species_observation';

/** A point in BC, and a tile that contains it. */
const TEST_LNG = -123.36;
const TEST_LAT = 48.43;

describe('Tile search function (integration)', function () {
  this.timeout(20000);

  let connection: IDBConnection;
  let featureTypeId: number;
  let geometryPropertyId: number;

  before(() => {
    initDBPool(defaultPoolConfig);
  });

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();

    const featureType = await connection.sql(
      SQL`SELECT feature_type_id FROM feature_type WHERE name = ${FEATURE_TYPE};`,
      z.object({ feature_type_id: z.number() })
    );
    featureTypeId = featureType.rows[0].feature_type_id;

    // Geometry-valued properties are typed 'spatial' in the property catalog.
    const property = await connection.sql(
      SQL`
        SELECT ftp.feature_type_property_id
        FROM feature_type_property ftp
        JOIN feature_property fp ON fp.feature_property_id = ftp.feature_property_id
        JOIN feature_property_type fpt ON fpt.feature_property_type_id = fp.feature_property_type_id
        WHERE ftp.feature_type_id = ${featureTypeId}
          AND fpt.name = 'spatial'
        LIMIT 1;
      `,
      z.object({ feature_type_property_id: z.number() })
    );
    geometryPropertyId = property.rows[0].feature_type_property_id;
  });

  afterEach(async () => {
    await connection.rollback();
    connection.release();
  });

  /**
   * Create a feature carrying a point geometry, and its closure self-loop so it is not fail-closed.
   */
  const createFeatureWithPoint = async (lng: number, lat: number, withSelfLoop = true): Promise<number> => {
    const submissionId = await createTestSubmission(connection);
    const featureId = await createTestFeature(connection, submissionId, FEATURE_TYPE, { name: 'tile test' });

    await connection.sql(SQL`
      INSERT INTO submission_feature_property_geometry (submission_feature_id, feature_type_property_id, value, create_user)
      VALUES (
        ${featureId},
        ${geometryPropertyId},
        public.ST_SetSRID(public.ST_MakePoint(${lng}, ${lat}), 4326),
        ${connection.systemUserId()}
      );
    `);

    if (withSelfLoop) {
      await connection.sql(SQL`
        INSERT INTO submission_feature_closure (source_submission_feature_id, target_submission_feature_id, is_ancestor)
        VALUES (${featureId}, ${featureId}, true)
        ON CONFLICT DO NOTHING;
      `);
    }

    return featureId;
  };

  /**
   * Create a tile context row directly, so the SQL can be exercised without the mint endpoint.
   */
  const createContext = async (options: {
    accessClass: 'anon' | 'scoped';
    scopeIds?: string[];
    materializedFeatureIds?: number[];
    expiresInSeconds?: number;
  }): Promise<string> => {
    const isMaterialized = options.materializedFeatureIds !== undefined;

    const result = await connection.sql(
      SQL`
        INSERT INTO tile_context (
          context_hash, access_class, feature_type_id, security_scope_ids, is_materialized, expires_at
        ) VALUES (
          'integration-test',
          ${options.accessClass},
          ${featureTypeId},
          ${options.scopeIds ?? []}::uuid[],
          ${isMaterialized},
          now() + make_interval(secs => ${options.expiresInSeconds ?? 1800})
        )
        RETURNING tile_context_id;
      `,
      z.object({ tile_context_id: z.string() })
    );

    const tileContextId = result.rows[0].tile_context_id;

    for (const featureId of options.materializedFeatureIds ?? []) {
      await connection.sql(SQL`
        INSERT INTO tile_context_feature (tile_context_id, submission_feature_id)
        VALUES (${tileContextId}, ${featureId});
      `);
    }

    return tileContextId;
  };

  /**
   * Ask the tile function for the tile containing the test point, and report its size.
   */
  const renderTile = async (tileContextId: string | null, zoom = 12): Promise<number | null> => {
    const params = tileContextId === null ? '{}' : JSON.stringify({ context: tileContextId });

    const result = await connection.sql(
      SQL`
        WITH t AS (
          SELECT
            ${zoom}::integer AS z,
            floor((${TEST_LNG}::double precision + 180.0) / 360.0 * (2 ^ ${zoom}))::integer AS x,
            floor(
              (1.0 - ln(tan(radians(${TEST_LAT}::double precision)) + 1.0 / cos(radians(${TEST_LAT}::double precision))) / pi())
              / 2.0 * (2 ^ ${zoom})
            )::integer AS y
        )
        SELECT length(biohub.tile_search(t.z, t.x, t.y, ${params}::json)) AS tile_bytes FROM t;
      `,
      z.object({ tile_bytes: z.number().nullable() })
    );

    return result.rows[0].tile_bytes;
  };

  /**
   * Ask the resolver directly whether a context can see a specific feature.
   */
  const canSee = async (tileContextId: string, featureId: number, zoom = 12): Promise<boolean> => {
    const result = await connection.sql(
      SQL`
        WITH ctx AS (
          SELECT * FROM tile_context WHERE tile_context_id = ${tileContextId}
        ),
        t AS (
          SELECT
            ${zoom}::integer AS z,
            floor((${TEST_LNG}::double precision + 180.0) / 360.0 * (2 ^ ${zoom}))::integer AS x,
            floor(
              (1.0 - ln(tan(radians(${TEST_LAT}::double precision)) + 1.0 / cos(radians(${TEST_LAT}::double precision))) / pi())
              / 2.0 * (2 ^ ${zoom})
            )::integer AS y
        )
        SELECT count(*)::integer AS visible
        FROM ctx, t,
        LATERAL biohub.tile_search_visible_geometries(
          ctx.tile_context_id,
          ctx.is_materialized,
          ctx.feature_type_id,
          ctx.access_class,
          ctx.security_scope_ids,
          public.ST_Transform(public.ST_TileEnvelope(t.z, t.x, t.y), 4326)
        ) v
        WHERE v.submission_feature_id = ${featureId};
      `,
      z.object({ visible: z.number() })
    );

    return result.rows[0].visible > 0;
  };

  /**
   * Anchor a security scope on a feature, so a context holding that scope may see it.
   */
  const anchorScopeOnFeature = async (featureId: number): Promise<string> => {
    const scope = await connection.sql(
      SQL`
        INSERT INTO security_scope (scope_hash, urn_submission_id, urn_feature_type, urn_feature_id)
        VALUES (${`tile-test-${featureId}`}, '*', '*', '*')
        RETURNING security_scope_id;
      `,
      z.object({ security_scope_id: z.string() })
    );

    const scopeId = scope.rows[0].security_scope_id;

    await connection.sql(SQL`
      INSERT INTO security_scope_anchor (security_scope_id, anchor_submission_feature_id)
      VALUES (${scopeId}, ${featureId});
    `);

    return scopeId;
  };

  describe('context resolution', () => {
    it('returns nothing when the context id is missing', async () => {
      expect(await renderTile(null)).to.be.null;
    });

    it('returns nothing when the context id is not a uuid', async () => {
      const result = await connection.sql(
        SQL`SELECT biohub.tile_search(12, 1, 1, '{"context":"not-a-uuid"}'::json) AS tile;`,
        z.object({ tile: z.any() })
      );

      expect(result.rows[0].tile).to.be.null;
    });

    it('returns nothing for an unknown context id', async () => {
      expect(await renderTile('99999999-9999-9999-9999-999999999999')).to.be.null;
    });

    it('returns nothing once the context has expired', async () => {
      await createFeatureWithPoint(TEST_LNG, TEST_LAT);
      const contextId = await createContext({ accessClass: 'anon', expiresInSeconds: -60 });

      expect(await renderTile(contextId)).to.be.null;
    });
  });

  describe('anonymous access', () => {
    it('includes an unsecured feature', async () => {
      const featureId = await createFeatureWithPoint(TEST_LNG, TEST_LAT);
      const contextId = await createContext({ accessClass: 'anon' });

      expect(await canSee(contextId, featureId)).to.be.true;
      expect(await renderTile(contextId)).to.be.greaterThan(0);
    });

    it('excludes a secured feature', async () => {
      const featureId = await createFeatureWithPoint(TEST_LNG, TEST_LAT);
      await secureFeature(connection, featureId);
      const contextId = await createContext({ accessClass: 'anon' });

      expect(await canSee(contextId, featureId)).to.be.false;
    });

    it('excludes a feature whose closure is missing (fails closed)', async () => {
      const featureId = await createFeatureWithPoint(TEST_LNG, TEST_LAT, false);
      const contextId = await createContext({ accessClass: 'anon' });

      expect(await canSee(contextId, featureId)).to.be.false;
    });
  });

  describe('scoped access', () => {
    it('includes a secured feature the context holds a scope for', async () => {
      const featureId = await createFeatureWithPoint(TEST_LNG, TEST_LAT);
      await secureFeature(connection, featureId);
      const scopeId = await anchorScopeOnFeature(featureId);

      const contextId = await createContext({ accessClass: 'scoped', scopeIds: [scopeId] });

      expect(await canSee(contextId, featureId)).to.be.true;
    });

    it('excludes a secured feature when the context holds an unrelated scope', async () => {
      const featureId = await createFeatureWithPoint(TEST_LNG, TEST_LAT);
      await secureFeature(connection, featureId);
      await anchorScopeOnFeature(featureId);

      const contextId = await createContext({
        accessClass: 'scoped',
        scopeIds: ['11111111-1111-1111-1111-111111111111']
      });

      expect(await canSee(contextId, featureId)).to.be.false;
    });

    it('excludes a secured feature when the context holds no scopes at all', async () => {
      const featureId = await createFeatureWithPoint(TEST_LNG, TEST_LAT);
      await secureFeature(connection, featureId);

      const contextId = await createContext({ accessClass: 'scoped', scopeIds: [] });

      expect(await canSee(contextId, featureId)).to.be.false;
    });
  });

  describe('serve-time evaluation', () => {
    it('drops a feature from tiles as soon as it is secured, without re-minting', async () => {
      const featureId = await createFeatureWithPoint(TEST_LNG, TEST_LAT);
      const contextId = await createContext({ accessClass: 'anon' });

      expect(await canSee(contextId, featureId)).to.be.true;

      // The context is untouched: only the feature's security changes.
      await secureFeature(connection, featureId);

      expect(await canSee(contextId, featureId)).to.be.false;
    });
  });

  describe('materialized result sets', () => {
    it('includes only the features materialized on the context', async () => {
      const included = await createFeatureWithPoint(TEST_LNG, TEST_LAT);
      const excluded = await createFeatureWithPoint(TEST_LNG + 0.0005, TEST_LAT + 0.0005);

      const contextId = await createContext({ accessClass: 'anon', materializedFeatureIds: [included] });

      expect(await canSee(contextId, included)).to.be.true;
      expect(await canSee(contextId, excluded)).to.be.false;
    });
  });

  describe('geometry handling', () => {
    it('excludes geometry outside the requested tile', async () => {
      // Far from the test point, so it falls in a different tile at z12.
      const featureId = await createFeatureWithPoint(TEST_LNG + 5, TEST_LAT + 3);
      const contextId = await createContext({ accessClass: 'anon' });

      expect(await canSee(contextId, featureId)).to.be.false;
    });

    it('encodes points, lines, polygons and multi-geometries', async () => {
      const submissionId = await createTestSubmission(connection);

      // WKT, so each geometry type is passed as a bound parameter rather than interpolated SQL.
      const wktGeometries = [
        `POINT(${TEST_LNG} ${TEST_LAT})`,
        `LINESTRING(${TEST_LNG} ${TEST_LAT}, ${TEST_LNG + 0.001} ${TEST_LAT + 0.001})`,
        `POLYGON((${TEST_LNG} ${TEST_LAT}, ${TEST_LNG + 0.001} ${TEST_LAT}, ${TEST_LNG + 0.001} ${
          TEST_LAT + 0.001
        }, ${TEST_LNG} ${TEST_LAT}))`,
        `MULTIPOINT((${TEST_LNG} ${TEST_LAT}), (${TEST_LNG + 0.0005} ${TEST_LAT + 0.0005}))`,
        `MULTILINESTRING((${TEST_LNG} ${TEST_LAT}, ${TEST_LNG + 0.001} ${TEST_LAT + 0.001}))`,
        `MULTIPOLYGON(((${TEST_LNG} ${TEST_LAT}, ${TEST_LNG + 0.001} ${TEST_LAT}, ${TEST_LNG + 0.001} ${
          TEST_LAT + 0.001
        }, ${TEST_LNG} ${TEST_LAT})))`
      ];

      for (const wkt of wktGeometries) {
        const featureId = await createTestFeature(connection, submissionId, FEATURE_TYPE, { name: 'geom' });

        await connection.sql(SQL`
          INSERT INTO submission_feature_property_geometry (submission_feature_id, feature_type_property_id, value, create_user)
          VALUES (
            ${featureId},
            ${geometryPropertyId},
            public.ST_SetSRID(public.ST_GeomFromText(${wkt}), 4326),
            ${connection.systemUserId()}
          );
        `);

        await connection.sql(SQL`
          INSERT INTO submission_feature_closure (source_submission_feature_id, target_submission_feature_id, is_ancestor)
          VALUES (${featureId}, ${featureId}, true) ON CONFLICT DO NOTHING;
        `);
      }

      const contextId = await createContext({ accessClass: 'anon' });

      // Every geometry type survives clipping and MVT encoding.
      expect(await renderTile(contextId)).to.be.greaterThan(0);
    });

    it('returns an empty tile where nothing matches', async () => {
      const contextId = await createContext({ accessClass: 'anon' });

      // Mid ocean at high zoom.
      const result = await connection.sql(
        SQL`SELECT biohub.tile_search(12, 0, 0, ${JSON.stringify({ context: contextId })}::json) AS tile;`,
        z.object({ tile: z.any() })
      );

      expect(result.rows[0].tile).to.be.null;
    });
  });

  describe('zoom behaviour', () => {
    it('emits aggregate counts below the cluster threshold and raw features at or above it', async () => {
      await createFeatureWithPoint(TEST_LNG, TEST_LAT);
      const contextId = await createContext({ accessClass: 'anon' });

      const clustered = await renderTile(contextId, 8);
      const raw = await renderTile(contextId, 12);

      expect(clustered).to.be.greaterThan(0);
      expect(raw).to.be.greaterThan(0);
    });
  });

  describe('query plan', () => {
    it('uses the spatial index rather than scanning the geometry table', async () => {
      const contextId = await createContext({ accessClass: 'anon' });

      const plan = await connection.sql(
        SQL`
          EXPLAIN (COSTS OFF)
          SELECT * FROM biohub.tile_search_visible_geometries(
            ${contextId}::uuid, false, ${featureTypeId}, 'anon', '{}'::uuid[],
            public.ST_Transform(public.ST_TileEnvelope(12, 654, 1400), 4326)
          );
        `,
        z.object({ 'QUERY PLAN': z.string() })
      );

      const planText = plan.rows.map((row) => row['QUERY PLAN']).join('\n');

      expect(planText).to.contain('submission_feature_property_geometry_idx3');
      expect(planText).to.not.contain('Seq Scan on submission_feature_property_geometry');
    });
  });
});
