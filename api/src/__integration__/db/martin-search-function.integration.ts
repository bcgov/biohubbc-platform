// Integration test for the authorized tile function — verifies that biohub.martin_search only ever
// encodes geometry the tile context is permitted to see, against the real database.
//
// This is the ticket's security boundary: the gateway authenticates, this SQL decides visibility.
// The suite therefore exercises the whole authorization matrix (anonymous, member-of-a-granted-team,
// unrelated member), the fail-safe paths, the serve-time guarantees (securing a feature or revoking
// a membership takes effect without re-minting), and — because the persisted expression is evaluated
// by a second implementation — a per-operator parity matrix proving the SQL evaluator and the
// TypeScript search evaluator agree on the same fixtures.
//
// Uses a transaction that is ROLLED BACK after each test, so no data is persisted. martin_search is
// SECURITY DEFINER, but it executes inside the caller's transaction, so uncommitted fixtures are
// visible to it.
//
// Run: make test-db
// Requires: make web (database must be running with seed data)

import { VectorTile } from '@mapbox/vector-tile';
import { expect } from 'chai';
import Protobuf from 'pbf';
import SQL from 'sql-template-strings';
import { z } from 'zod';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { ExpressionTree } from '../../models/expression-tree';
import { buildExpressionTreeFeatureIdsSubquery } from '../../repositories/expression-evaluation';
import { ExpressionPredicateSemanticValidator } from '../../services/expression-predicate-semantic-validator';
import { ExpressionTreeService } from '../../services/expression-tree-service';
import { addTeamMember, createTeam, secureFeature } from '../helpers/test-rbac-helpers';
import { createTestFeature, createTestSubmission } from '../helpers/test-submission-helpers';

/** Feature type used for the fixtures. Any type with a geometry property would do. */
const FEATURE_TYPE = 'species_observation';

/** A point in BC, and a tile that contains it. */
const TEST_LNG = -123.36;
const TEST_LAT = 48.43;

/** Identifiers of a feature property, as an expression predicate has to name both. */
interface PropertyIds {
  feature_property_id: number;
  feature_type_property_id: number;
}

describe('Tile search function (integration)', function () {
  this.timeout(60000);

  let connection: IDBConnection;
  let featureTypeId: number;
  let geometryProperty: PropertyIds;

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

    const spatial = await resolvePropertyByType('spatial');

    if (!spatial) {
      expect.fail(`no spatial property seeded for ${FEATURE_TYPE}`);
    }

    geometryProperty = spatial;
  });

  afterEach(async () => {
    await connection.rollback();
    connection.release();
  });

  /**
   * Resolve a property of the feature type under test by its property-type name.
   *
   * Looked up rather than hardcoded: the ids come from reference seed data and are not stable
   * across environments. Returns null when the type has no such property, so a test can skip.
   */
  const resolvePropertyByType = async (typeName: string): Promise<PropertyIds | null> => {
    const result = await connection.sql(
      SQL`
        SELECT fp.feature_property_id, ftp.feature_type_property_id
        FROM feature_type_property ftp
        JOIN feature_property fp
          ON fp.feature_property_id = ftp.feature_property_id
          AND fp.record_end_date IS NULL
        JOIN feature_property_type fpt
          ON fpt.feature_property_type_id = fp.feature_property_type_id
        WHERE ftp.feature_type_id = ${featureTypeId}
          AND ftp.record_end_date IS NULL
          AND fpt.name = ${typeName}
        ORDER BY fp.feature_property_id
        LIMIT 1;
      `,
      z.object({ feature_property_id: z.number(), feature_type_property_id: z.number() })
    );

    return result.rows[0] ?? null;
  };

  /**
   * Add a point geometry to an existing feature. A feature holds each of its spatial properties as
   * its own geometry row, so this can be called more than once for the same feature.
   */
  const addPointToFeature = async (featureId: number, lng: number, lat: number): Promise<void> => {
    await connection.sql(SQL`
      INSERT INTO submission_feature_property_geometry (submission_feature_id, feature_type_property_id, value, create_user)
      VALUES (
        ${featureId},
        ${geometryProperty.feature_type_property_id},
        public.ST_SetSRID(public.ST_MakePoint(${lng}, ${lat}), 4326),
        ${connection.systemUserId()}
      );
    `);
  };

  /**
   * Create a feature carrying a point geometry, and its closure self-loop so it is not fail-closed.
   */
  const createFeatureWithPoint = async (lng: number, lat: number, withSelfLoop = true): Promise<number> => {
    const submissionId = await createTestSubmission(connection);
    const featureId = await createTestFeature(connection, submissionId, FEATURE_TYPE, { name: 'tile test' });

    await addPointToFeature(featureId, lng, lat);

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
    systemUserId?: number | null;
    expressionId?: string | null;
    expiresInSeconds?: number;
  }): Promise<string> => {
    const result = await connection.sql(
      SQL`
        INSERT INTO martin_context (
          context_hash, expression_id, feature_type_id, system_user_id, record_end_date, create_user
        ) VALUES (
          'integration-test',
          ${options.expressionId ?? null},
          ${featureTypeId},
          ${options.systemUserId ?? null},
          now() + make_interval(secs => ${options.expiresInSeconds ?? 1800}),
          ${connection.systemUserId()}
        )
        RETURNING martin_context_id;
      `,
      z.object({ martin_context_id: z.string() })
    );

    return result.rows[0].martin_context_id;
  };

  /**
   * Ask the tile function for the tile containing the test point, and return the raw bytes.
   */
  const renderTileBytes = async (martinContextId: string | null, zoom = 12): Promise<Buffer | null> => {
    const params = martinContextId === null ? '{}' : JSON.stringify({ context: martinContextId });

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
        SELECT biohub.martin_search(t.z, t.x, t.y, ${params}::json) AS tile FROM t;
      `,
      z.object({ tile: z.any() })
    );

    return result.rows[0].tile ?? null;
  };

  /**
   * Ask the tile function for the tile containing the test point, and report its size.
   */
  const renderTile = async (martinContextId: string | null, zoom = 12): Promise<number | null> => {
    const tile = await renderTileBytes(martinContextId, zoom);

    return tile ? tile.length : null;
  };

  /**
   * Decode an MVT into its layers: each feature as its MVT feature id plus decoded properties.
   */
  const decodeTile = (
    tile: Buffer
  ): Record<string, { id: number | undefined; properties: Record<string, unknown> }[]> => {
    const vectorTile = new VectorTile(new Protobuf(tile));
    const layers: Record<string, { id: number | undefined; properties: Record<string, unknown> }[]> = {};

    for (const [name, layer] of Object.entries(vectorTile.layers)) {
      layers[name] = [];

      for (let index = 0; index < layer.length; index++) {
        const feature = layer.feature(index);
        layers[name].push({ id: feature.id, properties: feature.properties });
      }
    }

    return layers;
  };

  /**
   * Ask the resolver directly whether a context can see a specific feature.
   */
  const canSee = async (martinContextId: string, featureId: number, zoom = 12): Promise<boolean> => {
    const result = await connection.sql(
      SQL`
        WITH ctx AS (
          SELECT * FROM martin_context WHERE martin_context_id = ${martinContextId}
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
        LATERAL biohub.martin_search_visible_geometries(
          ctx.feature_type_id,
          ctx.system_user_id,
          ctx.expression_id,
          ctx.submission_ids,
          public.ST_Transform(public.ST_TileEnvelope(t.z, t.x, t.y), 4326)
        ) v
        WHERE v.submission_feature_id = ${featureId};
      `,
      z.object({ visible: z.number() })
    );

    return result.rows[0].visible > 0;
  };

  /**
   * Anchor a security scope on a feature, so a team holding that scope may see it.
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

  /**
   * Grant a user live access to a secured feature: anchor a scope on it, and put the user on a team
   * holding that scope. Returns the ids needed to revoke pieces of the chain.
   */
  const grantFeatureToUser = async (
    featureId: number,
    systemUserId: number
  ): Promise<{ scopeId: string; teamId: string }> => {
    const scopeId = await anchorScopeOnFeature(featureId);
    const teamId = await createTeam(connection, `tile-test-team-${featureId}`);

    await addTeamMember(connection, teamId, systemUserId);
    await connection.sql(SQL`
      INSERT INTO team_security_scope (team_id, security_scope_id)
      VALUES (${teamId}, ${scopeId});
    `);

    return { scopeId, teamId };
  };

  /** Insert a typed number property value on a feature. */
  const setNumberValue = async (featureId: number, property: PropertyIds, value: number): Promise<void> => {
    await connection.sql(SQL`
      INSERT INTO submission_feature_property_number (submission_feature_id, feature_type_property_id, value, create_user)
      VALUES (${featureId}, ${property.feature_type_property_id}, ${value}, ${connection.systemUserId()});
    `);
  };

  const predicate = (property: PropertyIds, operator: string, value?: unknown): ExpressionTree['clauses'][0] => ({
    type: 'predicate',
    feature_property_id: property.feature_property_id,
    feature_type_property_id: property.feature_type_property_id,
    operator: operator as never,
    value
  });

  const tree = (operator: 'AND' | 'OR', clauses: ExpressionTree['clauses']): ExpressionTree => ({
    type: 'expression',
    operator,
    clauses
  });

  /**
   * Persist an expression matching only features whose sentinel number property equals `value`, and
   * create a context evaluating it. Isolates a test's fixtures from whatever else the database holds.
   */
  const createSentinelContext = async (sentinelValue: number): Promise<string> => {
    const numberProperty = await resolvePropertyByType('number');

    if (!numberProperty) {
      expect.fail('the sentinel-context tests need a number property on the feature type');
    }

    const { expression_id } = await new ExpressionTreeService(connection).writeExpressionTree(
      tree('AND', [predicate(numberProperty, 'Equals', sentinelValue)])
    );

    return createContext({ expressionId: expression_id });
  };

  describe('context resolution', () => {
    it('returns nothing when the context id is missing', async () => {
      expect(await renderTile(null)).to.be.null;
    });

    it('returns nothing when the context id is not a uuid', async () => {
      const result = await connection.sql(
        SQL`SELECT biohub.martin_search(12, 1, 1, '{"context":"not-a-uuid"}'::json) AS tile;`,
        z.object({ tile: z.any() })
      );

      expect(result.rows[0].tile).to.be.null;
    });

    it('returns nothing for an unknown context id', async () => {
      expect(await renderTile('99999999-9999-9999-9999-999999999999')).to.be.null;
    });

    it('returns nothing once the context has expired', async () => {
      await createFeatureWithPoint(TEST_LNG, TEST_LAT);
      const contextId = await createContext({ expiresInSeconds: -60 });

      expect(await renderTile(contextId)).to.be.null;
    });
  });

  describe('anonymous access', () => {
    it('includes an unsecured feature', async () => {
      const featureId = await createFeatureWithPoint(TEST_LNG, TEST_LAT);
      const contextId = await createContext({});

      expect(await canSee(contextId, featureId)).to.be.true;
      expect(await renderTile(contextId)).to.be.greaterThan(0);
    });

    it('excludes a secured feature', async () => {
      const featureId = await createFeatureWithPoint(TEST_LNG, TEST_LAT);
      await secureFeature(connection, featureId);
      const contextId = await createContext({});

      expect(await canSee(contextId, featureId)).to.be.false;
    });

    it('excludes a feature whose closure is missing (fails closed)', async () => {
      const featureId = await createFeatureWithPoint(TEST_LNG, TEST_LAT, false);
      const contextId = await createContext({});

      expect(await canSee(contextId, featureId)).to.be.false;
    });
  });

  describe('live user access', () => {
    it('includes a secured feature for a member of a team holding the anchoring scope', async () => {
      const featureId = await createFeatureWithPoint(TEST_LNG, TEST_LAT);
      await secureFeature(connection, featureId);

      const systemUserId = connection.systemUserId();
      await grantFeatureToUser(featureId, systemUserId);

      const contextId = await createContext({ systemUserId });

      expect(await canSee(contextId, featureId)).to.be.true;
    });

    it('excludes a secured feature for a user with no relevant membership', async () => {
      const featureId = await createFeatureWithPoint(TEST_LNG, TEST_LAT);
      await secureFeature(connection, featureId);
      // The scope exists and is anchored, but no team of this user's holds it.
      await anchorScopeOnFeature(featureId);

      const contextId = await createContext({ systemUserId: connection.systemUserId() });

      expect(await canSee(contextId, featureId)).to.be.false;
    });

    it('drops a secured feature as soon as the membership is revoked, without re-minting', async () => {
      const featureId = await createFeatureWithPoint(TEST_LNG, TEST_LAT);
      await secureFeature(connection, featureId);

      const systemUserId = connection.systemUserId();
      const { teamId } = await grantFeatureToUser(featureId, systemUserId);

      const contextId = await createContext({ systemUserId });

      expect(await canSee(contextId, featureId)).to.be.true;

      // The context is untouched: only the membership changes. Under a mint-time snapshot this
      // would keep serving until the context expired; live evaluation drops it immediately.
      await connection.sql(SQL`
        UPDATE team_member SET record_end_date = now()
        WHERE team_id = ${teamId} AND system_user_id = ${systemUserId};
      `);

      expect(await canSee(contextId, featureId)).to.be.false;
    });
  });

  describe('serve-time evaluation', () => {
    it('drops a feature from tiles as soon as it is secured, without re-minting', async () => {
      const featureId = await createFeatureWithPoint(TEST_LNG, TEST_LAT);
      const contextId = await createContext({});

      expect(await canSee(contextId, featureId)).to.be.true;

      // The context is untouched: only the feature's security changes.
      await secureFeature(connection, featureId);

      expect(await canSee(contextId, featureId)).to.be.false;
    });
  });

  describe('expression evaluation', () => {
    const setStringValue = async (featureId: number, property: PropertyIds, value: string): Promise<void> => {
      await connection.sql(SQL`
        INSERT INTO submission_feature_property_string (submission_feature_id, feature_type_property_id, value, create_user)
        VALUES (${featureId}, ${property.feature_type_property_id}, ${value}, ${connection.systemUserId()});
      `);
    };

    const setTimestampValue = async (featureId: number, property: PropertyIds, isoDate: string): Promise<void> => {
      await connection.sql(SQL`
        INSERT INTO submission_feature_property_timestamp (
          submission_feature_id, feature_type_property_id, date_value, time_value, create_user
        )
        VALUES (
          ${featureId}, ${property.feature_type_property_id}, ${isoDate}::date, '00:00:00'::time,
          ${connection.systemUserId()}
        );
      `);
    };

    const setBooleanValue = async (featureId: number, property: PropertyIds, value: boolean): Promise<void> => {
      await connection.sql(SQL`
        INSERT INTO submission_feature_property_boolean (submission_feature_id, feature_type_property_id, value, create_user)
        VALUES (${featureId}, ${property.feature_type_property_id}, ${value}, ${connection.systemUserId()});
      `);
    };

    /**
     * Assert the SQL evaluator and the TypeScript search evaluator agree on which of the given
     * features match the expression — and that the outcome is the expected one.
     *
     * This is the divergence guard: the map's per-tile evaluation and the table view's set-based
     * evaluation are separate implementations of the same semantics, and every operator family goes
     * through here so a drift in either fails loudly.
     */
    const expectParity = async (
      expressionTree: ExpressionTree,
      featureIds: number[],
      expectedMatches: number[]
    ): Promise<void> => {
      const validator = new ExpressionPredicateSemanticValidator(connection);
      const normalized = await validator.validateExpressionTree(expressionTree);

      // The TypeScript evaluator, exactly as the search endpoint composes it (anonymous caller).
      const subquery = buildExpressionTreeFeatureIdsSubquery(FEATURE_TYPE, normalized, null).whereIn(
        'submission_feature_id',
        featureIds
      );
      const tsResult = await connection.knex(subquery, z.object({ submission_feature_id: z.number() }));
      const tsMatches = tsResult.rows.map((row) => row.submission_feature_id).sort((a, b) => a - b);

      // The SQL evaluator, via the persisted expression.
      const { expression_id } = await new ExpressionTreeService(connection).writeExpressionTree(expressionTree);

      const pgMatches: number[] = [];

      for (const featureId of featureIds) {
        const result = await connection.sql(
          SQL`
            SELECT biohub.martin_expression_matches(
              ${expression_id}, ${featureId}, ${featureTypeId}, NULL
            ) AS matches;
          `,
          z.object({ matches: z.boolean() })
        );

        if (result.rows[0].matches) {
          pgMatches.push(featureId);
        }
      }

      const expected = [...expectedMatches].sort((a, b) => a - b);

      expect(pgMatches, 'SQL evaluator result').to.eql(expected);
      expect(tsMatches, 'TypeScript evaluator result').to.eql(expected);
    };

    it('applies a persisted expression to tiles, and a NULL expression browses all', async function () {
      const numberProperty = await resolvePropertyByType('number');

      if (!numberProperty) {
        this.skip();
      }

      const matching = await createFeatureWithPoint(TEST_LNG, TEST_LAT);
      const other = await createFeatureWithPoint(TEST_LNG + 0.0005, TEST_LAT + 0.0005);

      await setNumberValue(matching, numberProperty, 50);
      await setNumberValue(other, numberProperty, 5);

      const search = tree('AND', [predicate(numberProperty, 'GreaterThanOrEqual', 10)]);
      const { expression_id } = await new ExpressionTreeService(connection).writeExpressionTree(search);

      const filtered = await createContext({ expressionId: expression_id });
      const browseAll = await createContext({});

      expect(await canSee(filtered, matching)).to.be.true;
      expect(await canSee(filtered, other)).to.be.false;

      expect(await canSee(browseAll, matching)).to.be.true;
      expect(await canSee(browseAll, other)).to.be.true;
    });

    it('discards secured evidence before evaluating, exactly as the search does', async function () {
      const numberProperty = await resolvePropertyByType('number');

      if (!numberProperty) {
        this.skip();
      }

      const featureId = await createFeatureWithPoint(TEST_LNG, TEST_LAT);
      await setNumberValue(featureId, numberProperty, 50);
      await secureFeature(connection, featureId);

      // The feature's own property row is its evidence; secured evidence must not match for an
      // anonymous caller even before the anchor-level filter is considered.
      await expectParity(tree('AND', [predicate(numberProperty, 'GreaterThanOrEqual', 10)]), [featureId], []);
    });

    describe('operator parity with the search evaluator', () => {
      it('number operators', async function () {
        const numberProperty = await resolvePropertyByType('number');

        if (!numberProperty) {
          this.skip();
        }

        const low = await createFeatureWithPoint(TEST_LNG, TEST_LAT);
        const high = await createFeatureWithPoint(TEST_LNG + 0.0005, TEST_LAT);
        const bare = await createFeatureWithPoint(TEST_LNG, TEST_LAT + 0.0005);

        await setNumberValue(low, numberProperty, 5);
        await setNumberValue(high, numberProperty, 50);

        const all = [low, high, bare];

        await expectParity(tree('AND', [predicate(numberProperty, 'Equals', 50)]), all, [high]);
        await expectParity(tree('AND', [predicate(numberProperty, 'GreaterThan', 10)]), all, [high]);
        await expectParity(tree('AND', [predicate(numberProperty, 'LessThanOrEqual', 5)]), all, [low]);
        // Feature-level NotEquals: carries the property, with no row equal to the value. The bare
        // feature has no row at all, so it must not match either.
        await expectParity(tree('AND', [predicate(numberProperty, 'NotEquals', 50)]), all, [low]);
        await expectParity(tree('AND', [predicate(numberProperty, 'Exists')]), all, [low, high]);
      });

      it('string operators', async function () {
        const stringProperty = await resolvePropertyByType('string');

        if (!stringProperty) {
          this.skip();
        }

        const caribou = await createFeatureWithPoint(TEST_LNG, TEST_LAT);
        const moose = await createFeatureWithPoint(TEST_LNG + 0.0005, TEST_LAT);

        await setStringValue(caribou, stringProperty, 'Woodland Caribou');
        await setStringValue(moose, stringProperty, 'Moose');

        const all = [caribou, moose];

        await expectParity(tree('AND', [predicate(stringProperty, 'Equals', 'Moose')]), all, [moose]);
        await expectParity(tree('AND', [predicate(stringProperty, 'Contains', 'caribou')]), all, [caribou]);
        await expectParity(tree('AND', [predicate(stringProperty, 'StartsWith', 'wood')]), all, [caribou]);
        await expectParity(tree('AND', [predicate(stringProperty, 'EndsWith', 'bou')]), all, [caribou]);
        await expectParity(tree('AND', [predicate(stringProperty, 'NotEquals', 'Moose')]), all, [caribou]);
      });

      it('timestamp operators', async function () {
        const datetimeProperty = await resolvePropertyByType('datetime');

        if (!datetimeProperty) {
          this.skip();
        }

        const early = await createFeatureWithPoint(TEST_LNG, TEST_LAT);
        const late = await createFeatureWithPoint(TEST_LNG + 0.0005, TEST_LAT);

        await setTimestampValue(early, datetimeProperty, '2020-01-15');
        await setTimestampValue(late, datetimeProperty, '2024-06-30');

        const all = [early, late];

        // The API-level tree carries datetime values as scalar strings; the validator splits them.
        await expectParity(tree('AND', [predicate(datetimeProperty, 'OnDate', '2020-01-15')]), all, [early]);
        await expectParity(tree('AND', [predicate(datetimeProperty, 'Before', '2022-01-01')]), all, [early]);
        await expectParity(tree('AND', [predicate(datetimeProperty, 'After', '2022-01-01')]), all, [late]);
      });

      it('boolean operators', async function () {
        const booleanProperty = await resolvePropertyByType('boolean');

        if (!booleanProperty) {
          this.skip();
        }

        const yes = await createFeatureWithPoint(TEST_LNG, TEST_LAT);
        const no = await createFeatureWithPoint(TEST_LNG + 0.0005, TEST_LAT);

        await setBooleanValue(yes, booleanProperty, true);
        await setBooleanValue(no, booleanProperty, false);

        const all = [yes, no];

        await expectParity(tree('AND', [predicate(booleanProperty, 'Equals', true)]), all, [yes]);
      });

      it('geometry operators', async function () {
        const near = await createFeatureWithPoint(TEST_LNG, TEST_LAT);
        const far = await createFeatureWithPoint(TEST_LNG + 5, TEST_LAT + 3);

        const aroundTestPoint = {
          type: 'Polygon',
          coordinates: [
            [
              [TEST_LNG - 0.01, TEST_LAT - 0.01],
              [TEST_LNG + 0.01, TEST_LAT - 0.01],
              [TEST_LNG + 0.01, TEST_LAT + 0.01],
              [TEST_LNG - 0.01, TEST_LAT + 0.01],
              [TEST_LNG - 0.01, TEST_LAT - 0.01]
            ]
          ]
        };

        const all = [near, far];

        await expectParity(tree('AND', [predicate(geometryProperty, 'Intersects', aroundTestPoint)]), all, [near]);
        await expectParity(tree('AND', [predicate(geometryProperty, 'Within', aroundTestPoint)]), all, [near]);
      });

      it('logical composition', async function () {
        const numberProperty = await resolvePropertyByType('number');
        const stringProperty = await resolvePropertyByType('string');

        if (!numberProperty || !stringProperty) {
          this.skip();
        }

        const both = await createFeatureWithPoint(TEST_LNG, TEST_LAT);
        const onlyNumber = await createFeatureWithPoint(TEST_LNG + 0.0005, TEST_LAT);
        const neither = await createFeatureWithPoint(TEST_LNG, TEST_LAT + 0.0005);

        await setNumberValue(both, numberProperty, 50);
        await setStringValue(both, stringProperty, 'Caribou');
        await setNumberValue(onlyNumber, numberProperty, 50);
        await setStringValue(onlyNumber, stringProperty, 'Moose');

        const all = [both, onlyNumber, neither];

        await expectParity(
          tree('AND', [predicate(numberProperty, 'GreaterThan', 10), predicate(stringProperty, 'Contains', 'caribou')]),
          all,
          [both]
        );

        await expectParity(
          tree('OR', [predicate(numberProperty, 'GreaterThan', 10), predicate(stringProperty, 'Contains', 'caribou')]),
          all,
          [both, onlyNumber]
        );

        // Nested: number > 10 AND (caribou OR moose).
        await expectParity(
          {
            type: 'expression',
            operator: 'AND',
            clauses: [
              predicate(numberProperty, 'GreaterThan', 10),
              tree('OR', [
                predicate(stringProperty, 'Contains', 'caribou'),
                predicate(stringProperty, 'Contains', 'moose')
              ])
            ]
          },
          all,
          [both, onlyNumber]
        );
      });
    });
  });

  describe('geometry handling', () => {
    it('still renders geometry just outside the tile, so strokes are not clipped at the edge', async () => {
      // ST_AsMVTGeom draws into a buffer beyond the tile, so a feature sitting just outside the
      // exact bounds still contributes to what this tile shows. Selecting candidates on the exact
      // envelope would drop it before rendering and clip geometry at every tile seam. Asserted
      // through martin_search itself, since that is where the candidate envelope is expanded.
      const zoom = 12;
      const contextId = await createContext({});

      const bounds = await connection.sql(
        SQL`
          SELECT
            public.ST_XMin(env) AS min_x,
            public.ST_XMax(env) AS max_x,
            public.ST_YMin(env) AS min_y,
            public.ST_YMax(env) AS max_y
          FROM (
            SELECT public.ST_Transform(
              public.ST_TileEnvelope(
                ${zoom},
                floor((${TEST_LNG}::double precision + 180.0) / 360.0 * (2 ^ ${zoom}))::integer,
                floor(
                  (1.0 - ln(tan(radians(${TEST_LAT}::double precision)) + 1.0 / cos(radians(${TEST_LAT}::double precision))) / pi())
                  / 2.0 * (2 ^ ${zoom})
                )::integer
              ),
              4326
            ) AS env
          ) e;
        `,
        z.object({ min_x: z.number(), max_x: z.number(), min_y: z.number(), max_y: z.number() })
      );

      const { min_x, max_x, min_y, max_y } = bounds.rows[0];
      const before = (await renderTile(contextId, zoom)) ?? 0;

      // A short way past the western edge: outside the tile, inside the 64/4096 render buffer.
      await createFeatureWithPoint(min_x - (max_x - min_x) * 0.005, (min_y + max_y) / 2);

      const after = (await renderTile(contextId, zoom)) ?? 0;

      expect(after, 'a feature in the buffer margin should still reach the tile').to.be.greaterThan(before);
    });

    it('excludes geometry outside the requested tile', async () => {
      // Far from the test point, so it falls in a different tile at z12.
      const featureId = await createFeatureWithPoint(TEST_LNG + 5, TEST_LAT + 3);
      const contextId = await createContext({});

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
            ${geometryProperty.feature_type_property_id},
            public.ST_SetSRID(public.ST_GeomFromText(${wkt}), 4326),
            ${connection.systemUserId()}
          );
        `);

        await connection.sql(SQL`
          INSERT INTO submission_feature_closure (source_submission_feature_id, target_submission_feature_id, is_ancestor)
          VALUES (${featureId}, ${featureId}, true) ON CONFLICT DO NOTHING;
        `);
      }

      const contextId = await createContext({});

      // Every geometry type survives clipping and MVT encoding.
      expect(await renderTile(contextId)).to.be.greaterThan(0);
    });

    it('returns an empty tile where nothing matches', async () => {
      const contextId = await createContext({});

      // Mid ocean at high zoom.
      const result = await connection.sql(
        SQL`SELECT biohub.martin_search(12, 0, 0, ${JSON.stringify({ context: contextId })}::json) AS tile;`,
        z.object({ tile: z.any() })
      );

      expect(result.rows[0].tile).to.be.null;
    });
  });

  describe('zoom behaviour', () => {
    /** Cluster zoom, and a longitude offset landing in the same tile but a different grid cell. */
    const CLUSTER_ZOOM = 8;
    const OTHER_CELL_LNG_OFFSET = 0.4;

    /** Total of every cluster's count in a rendered tile. */
    const sumClusterCounts = (tile: Buffer): number => {
      const layer = new VectorTile(new Protobuf(tile)).layers.clusters;
      let total = 0;

      for (let index = 0; index < layer.length; index++) {
        total += Number(layer.feature(index).properties.location_count);
      }

      return total;
    };

    it('emits aggregate counts below the cluster threshold and raw features at or above it', async () => {
      await createFeatureWithPoint(TEST_LNG, TEST_LAT);
      const contextId = await createContext({});

      const clustered = await renderTile(contextId, CLUSTER_ZOOM);
      const raw = await renderTile(contextId, 12);

      expect(clustered).to.be.greaterThan(0);
      expect(raw).to.be.greaterThan(0);
    });

    it('counts every geometry of a feature separately', async () => {
      // A feature records each spatial property as its own geometry row, and every row is drawn
      // individually at high zoom. Clustering counts the same things, so a second geometry on an
      // existing feature adds one to the totals rather than merely moving that feature's point.
      const featureId = await createFeatureWithPoint(TEST_LNG, TEST_LAT);
      const contextId = await createContext({});

      const before = await renderTileBytes(contextId, CLUSTER_ZOOM);

      expect(before).to.not.be.null;

      await addPointToFeature(featureId, TEST_LNG + OTHER_CELL_LNG_OFFSET, TEST_LAT);

      const after = await renderTileBytes(contextId, CLUSTER_ZOOM);

      expect(after).to.not.be.null;
      // A delta rather than an absolute, so seeded features sharing the tile cannot affect it.
      expect(sumClusterCounts(after as Buffer) - sumClusterCounts(before as Buffer)).to.equal(1);
    });
  });

  describe('tile contract', () => {
    it('encodes individual results as geometry only: no identifiers, no attributes, no MVT id', async () => {
      await createFeatureWithPoint(TEST_LNG, TEST_LAT);
      const contextId = await createContext({});

      const tile = await renderTileBytes(contextId, 12);
      expect(tile).to.not.be.null;

      const layers = decodeTile(tile as Buffer);
      expect(Object.keys(layers)).to.deep.equal(['features']);
      expect(layers.features.length).to.be.greaterThan(0);

      for (const encoded of layers.features) {
        // The shape itself is the entire payload; anything about the result stays behind the API.
        expect(encoded.properties).to.deep.equal({});
        expect(encoded.id, 'features carry no MVT feature id').to.be.undefined;
      }
    });

    it('encodes a cluster as its count and nothing else', async () => {
      await createFeatureWithPoint(TEST_LNG, TEST_LAT);
      await createFeatureWithPoint(TEST_LNG + 0.001, TEST_LAT + 0.001);
      const contextId = await createContext({});

      const tile = await renderTileBytes(contextId, 6);
      expect(tile).to.not.be.null;

      const layers = decodeTile(tile as Buffer);
      expect(Object.keys(layers)).to.deep.equal(['clusters']);
      expect(layers.clusters.length).to.be.greaterThan(0);

      for (const cluster of layers.clusters) {
        expect(cluster.properties.location_count).to.be.a('number');
        expect(cluster.properties.location_count).to.be.greaterThan(0);
        // The count is the only attribute: an aggregate, never an identity.
        expect(Object.keys(cluster.properties)).to.deep.equal(['location_count']);
        expect(cluster.id, 'clusters carry no MVT feature id').to.be.undefined;
      }

      const total = layers.clusters.reduce((sum, cluster) => sum + Number(cluster.properties.location_count), 0);
      expect(total).to.be.at.least(2);
    });
  });

  describe('cluster grid', () => {
    /** Render an explicit tile, rather than the one containing the test point. */
    const renderTileAt = async (
      martinContextId: string,
      zoom: number,
      x: number,
      y: number
    ): Promise<Buffer | null> => {
      const result = await connection.sql(
        SQL`
          SELECT biohub.martin_search(${zoom}, ${x}, ${y}, ${JSON.stringify({
          context: martinContextId
        })}::json) AS tile;
        `,
        z.object({ tile: z.instanceof(Buffer).nullable() })
      );

      return result.rows[0].tile;
    };

    /** Decode the clusters layer including each cluster's tile-coordinate position. */
    const decodeClusterPoints = (tile: Buffer): { x: number; y: number; count: number }[] => {
      const vectorTile = new VectorTile(new Protobuf(tile));
      const layer = vectorTile.layers.clusters;
      const clusters: { x: number; y: number; count: number }[] = [];

      for (let index = 0; index < layer.length; index++) {
        const feature = layer.feature(index);
        const [point] = feature.loadGeometry()[0];
        clusters.push({ x: point.x, y: point.y, count: Number(feature.properties.location_count) });
      }

      return clusters;
    };

    it('never splits a cluster across a tile seam', async function () {
      // Two adjacent tiles at a cluster zoom, and features hugging their shared edge. With a
      // min-corner snap origin, a grid NODE lands exactly ON the seam, so the points nearest the
      // edge break away from their cell-mates into an edge cluster - drawn from both sides with
      // split counts. Centre-origin snapping makes cell EDGES land on the seam instead: every
      // point groups with its whole world cell, owned by exactly one tile.
      const zoom = 6;
      const leftX = Math.floor(((TEST_LNG + 180) / 360) * 2 ** zoom);
      const tileY = Math.floor(
        ((1 - Math.log(Math.tan((TEST_LAT * Math.PI) / 180) + 1 / Math.cos((TEST_LAT * Math.PI) / 180)) / Math.PI) /
          2) *
          2 ** zoom
      );
      // Longitude of the seam between leftX and leftX + 1, and of one grid cell (an eighth of a tile).
      const seamLng = ((leftX + 1) / 2 ** zoom) * 360 - 180;
      const cellLng = 360 / 2 ** zoom / 8;

      // Three points spread across the LAST world cell on the left side of the seam. Under the
      // broken min-corner grid the two nearest the seam snap to the seam node while the third
      // snaps a cell inward, splitting one cell into two clusters.
      const leftFeatureIds = [
        await createFeatureWithPoint(seamLng - cellLng * 0.05, TEST_LAT),
        await createFeatureWithPoint(seamLng - cellLng * 0.4, TEST_LAT),
        await createFeatureWithPoint(seamLng - cellLng * 0.95, TEST_LAT)
      ];
      const rightFeatureId = await createFeatureWithPoint(seamLng + cellLng * 0.1, TEST_LAT);

      // The exact-count assertions below need the tile to hold ONLY these fixtures, so the context
      // evaluates a sentinel expression matching them alone rather than browsing the whole type.
      const sentinel = 903001;
      const numberProperty = await resolvePropertyByType('number');

      if (!numberProperty) {
        this.skip();
        return;
      }

      for (const featureId of [...leftFeatureIds, rightFeatureId]) {
        await setNumberValue(featureId, numberProperty, sentinel);
      }

      const contextId = await createSentinelContext(sentinel);

      const [leftTile, rightTile] = await Promise.all([
        renderTileAt(contextId, zoom, leftX, tileY),
        renderTileAt(contextId, zoom, leftX + 1, tileY)
      ]);

      expect(leftTile, 'both seam tiles should render clusters').to.not.be.null;
      expect(rightTile, 'both seam tiles should render clusters').to.not.be.null;

      const leftClusters = decodeClusterPoints(leftTile as Buffer);
      const rightClusters = decodeClusterPoints(rightTile as Buffer);

      // One cell, one cluster: all three left-side points share a world cell, so they must emerge
      // as a single bubble carrying the full count rather than an edge bubble plus a remainder.
      expect(leftClusters).to.have.length(1);
      expect(leftClusters[0].count).to.equal(leftFeatureIds.length);
      expect(rightClusters).to.have.length(1);
      expect(rightClusters[0].count).to.equal(1);

      for (const cluster of [...leftClusters, ...rightClusters]) {
        // And every emitted cluster sits strictly inside its own tile - never on the shared edge,
        // never duplicated into the neighbour's buffer margin.
        expect(cluster.x, 'cluster x must be strictly inside the tile').to.be.greaterThan(0).and.lessThan(4096);
        expect(cluster.y, 'cluster y must be strictly inside the tile').to.be.greaterThan(0).and.lessThan(4096);
      }
    });
  });

  describe('query plan', () => {
    it('uses the spatial index rather than scanning the geometry table', async () => {
      const plan = await connection.sql(
        SQL`
          EXPLAIN (COSTS OFF)
          SELECT * FROM biohub.martin_search_visible_geometries(
            ${featureTypeId}, NULL, NULL, NULL,
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
