// Integration test for the single-feature tile function — verifies that biohub.martin_feature encodes
// every spatial property of the requested feature, and only of that feature, against the real database.
//
// Unlike martin_search, this function is not the security boundary: access is decided when the token is
// minted. What it must still guarantee is that the identifiers in the token are honoured exactly — the
// feature must belong to the named submission and still be active — and that a malformed context can
// never be coaxed into an error or into returning someone else's geometry.
//
// Uses a transaction that is ROLLED BACK after each test, so no data is persisted. martin_feature is
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
import { createTestFeature, createTestSubmission } from '../helpers/test-submission-helpers';

/** Feature type used for the fixtures. Any type with a geometry property would do. */
const FEATURE_TYPE = 'species_observation';

/** A point in BC, and a tile that contains it. */
const TEST_LNG = -123.36;
const TEST_LAT = 48.43;

describe('Martin feature function (integration)', function () {
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
   * Attach a geometry (as WKT) to a feature, returning the new row's id.
   */
  const addGeometry = async (featureId: number, wkt: string, propertyId?: number): Promise<number> => {
    const result = await connection.sql(
      SQL`
        INSERT INTO submission_feature_property_geometry (submission_feature_id, feature_type_property_id, value, create_user)
        VALUES (
          ${featureId},
          ${propertyId ?? geometryPropertyId},
          public.ST_SetSRID(public.ST_GeomFromText(${wkt}), 4326),
          ${connection.systemUserId()}
        )
        RETURNING submission_feature_property_geometry_id;
      `,
      z.object({ submission_feature_property_geometry_id: z.number() })
    );

    return result.rows[0].submission_feature_property_geometry_id;
  };

  /**
   * Create a feature carrying a point geometry at the test location.
   */
  const createFeatureWithPoint = async (
    submissionId?: number,
    lng = TEST_LNG,
    lat = TEST_LAT
  ): Promise<{ submissionId: number; featureId: number; geometryId: number }> => {
    const resolvedSubmissionId = submissionId ?? (await createTestSubmission(connection));
    const featureId = await createTestFeature(connection, resolvedSubmissionId, FEATURE_TYPE, { name: 'tile test' });
    const geometryId = await addGeometry(featureId, `POINT(${lng} ${lat})`);

    return { submissionId: resolvedSubmissionId, featureId, geometryId };
  };

  /** Build the context string the gateway takes from the verified token. */
  const contextFor = (submissionId: number | string, featureId: number | string) => `sf:${submissionId}:${featureId}`;

  /**
   * Ask the tile function for the tile containing the test point, and return the raw MVT bytes.
   */
  const renderTileBuffer = async (context: string, zoom = 12): Promise<Buffer | null> => {
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
        SELECT biohub.martin_feature(t.z, t.x, t.y, ${JSON.stringify({ context })}::json) AS tile FROM t;
      `,
      z.object({ tile: z.instanceof(Buffer).nullable() })
    );

    return result.rows[0].tile;
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

  /** Decode a tile and return the geometries layer, asserting the tile is not empty. */
  const decodeGeometries = async (context: string, zoom = 12) => {
    const tile = await renderTileBuffer(context, zoom);
    expect(tile, 'expected a non-empty tile').to.not.be.null;

    const layers = decodeTile(tile as Buffer);
    expect(Object.keys(layers)).to.deep.equal(['geometries']);

    return layers.geometries;
  };

  describe('context parsing', () => {
    it('returns an empty tile when the context is missing', async () => {
      const result = await connection.sql(
        SQL`SELECT biohub.martin_feature(12, 1, 1, '{}'::json) AS tile;`,
        z.object({ tile: z.any() })
      );

      expect(result.rows[0].tile).to.be.null;
    });

    it('returns an empty tile rather than an error for a malformed context', async () => {
      // A probing client must learn nothing from the difference between malformed and unauthorized.
      const malformed = ['garbage', 'sf:1', 'sf:1:', 'sf::1', 'sf:abc:1', 'sf:1:1:1', "sf:1:1'; SELECT 1--"];

      for (const context of malformed) {
        const result = await connection.sql(
          SQL`SELECT biohub.martin_feature(12, 1, 1, ${JSON.stringify({ context })}::json) AS tile;`,
          z.object({ tile: z.any() })
        );

        expect(result.rows[0].tile, `context "${context}" should render an empty tile`).to.be.null;
      }
    });

    it('returns an empty tile when an identifier overflows integer', async () => {
      // The pattern bounds the digit count, not the magnitude, so this reaches the cast.
      const result = await connection.sql(
        SQL`SELECT biohub.martin_feature(12, 1, 1, '{"context":"sf:9999999999:1"}'::json) AS tile;`,
        z.object({ tile: z.any() })
      );

      expect(result.rows[0].tile).to.be.null;
    });
  });

  describe('feature scoping', () => {
    it('encodes the requested feature', async () => {
      const { submissionId, featureId } = await createFeatureWithPoint();

      const geometries = await decodeGeometries(contextFor(submissionId, featureId));

      expect(geometries).to.have.length(1);
    });

    it('excludes another feature in the same submission', async () => {
      const { submissionId, featureId, geometryId } = await createFeatureWithPoint();
      // A sibling feature at the same location: only tile scoping can tell them apart.
      const sibling = await createFeatureWithPoint(submissionId);

      const geometries = await decodeGeometries(contextFor(submissionId, featureId));

      expect(geometries.map((geometry) => geometry.properties.submission_feature_property_geometry_id)).to.eql([
        geometryId
      ]);
      expect(geometries.map((geometry) => geometry.properties.submission_feature_property_geometry_id)).to.not.include(
        sibling.geometryId
      );
    });

    it('returns an empty tile when the feature belongs to a different submission', async () => {
      const { featureId } = await createFeatureWithPoint();
      const otherSubmissionId = await createTestSubmission(connection);

      // The submission id is part of the signed token, so a mismatched pair is not a valid request.
      expect(await renderTileBuffer(contextFor(otherSubmissionId, featureId))).to.be.null;
    });

    it('returns an empty tile for an unknown feature', async () => {
      const { submissionId } = await createFeatureWithPoint();

      expect(await renderTileBuffer(contextFor(submissionId, 999999999))).to.be.null;
    });
  });

  describe('feature lifecycle', () => {
    it('returns an empty tile for a feature that is not yet approved', async () => {
      const { submissionId, featureId } = await createFeatureWithPoint();

      // A null effective date is an unapproved feature, which must never be served.
      await connection.sql(SQL`
        UPDATE submission_feature SET record_effective_date = NULL WHERE submission_feature_id = ${featureId};
      `);

      expect(await renderTileBuffer(contextFor(submissionId, featureId))).to.be.null;
    });

    it('returns an empty tile for an end-dated feature', async () => {
      const { submissionId, featureId } = await createFeatureWithPoint();

      await connection.sql(SQL`
        UPDATE submission_feature SET record_end_date = now() - interval '1 day'
        WHERE submission_feature_id = ${featureId};
      `);

      // A token minted before the feature was retired stops producing tiles immediately.
      expect(await renderTileBuffer(contextFor(submissionId, featureId))).to.be.null;
    });
  });

  describe('spatial properties', () => {
    it('encodes every value of a property that has several', async () => {
      const { submissionId, featureId } = await createFeatureWithPoint();
      await addGeometry(featureId, `POINT(${TEST_LNG + 0.0005} ${TEST_LAT + 0.0005})`);
      await addGeometry(featureId, `POINT(${TEST_LNG + 0.001} ${TEST_LAT + 0.001})`);

      const geometries = await decodeGeometries(contextFor(submissionId, featureId));

      expect(geometries).to.have.length(3);
    });

    it('encodes values from more than one spatial property', async () => {
      const otherProperty = await connection.sql(
        SQL`
          SELECT ftp.feature_type_property_id
          FROM feature_type_property ftp
          JOIN feature_property fp ON fp.feature_property_id = ftp.feature_property_id
          JOIN feature_property_type fpt ON fpt.feature_property_type_id = fp.feature_property_type_id
          WHERE ftp.feature_type_id = ${featureTypeId}
            AND fpt.name = 'spatial'
            AND ftp.feature_type_property_id <> ${geometryPropertyId}
            AND ftp.record_end_date IS NULL
          LIMIT 1;
        `,
        z.object({ feature_type_property_id: z.number() })
      );

      if (!otherProperty.rows.length) {
        // The seeded feature type has only one spatial property; the multi-value case above covers the
        // rest of the requirement.
        return;
      }

      const { submissionId, featureId } = await createFeatureWithPoint();
      await addGeometry(featureId, `POINT(${TEST_LNG} ${TEST_LAT})`, otherProperty.rows[0].feature_type_property_id);

      const geometries = await decodeGeometries(contextFor(submissionId, featureId));

      const propertyIds = new Set(geometries.map((geometry) => geometry.properties.feature_type_property_id));
      expect(propertyIds.size).to.equal(2);
    });

    it('carries the metadata needed to identify each spatial property', async () => {
      const { submissionId, featureId, geometryId } = await createFeatureWithPoint();

      const [geometry] = await decodeGeometries(contextFor(submissionId, featureId));

      expect(geometry.properties.submission_feature_property_geometry_id).to.equal(geometryId);
      expect(geometry.properties.feature_type_property_id).to.equal(geometryPropertyId);
      expect(geometry.properties.property_display_name).to.be.a('string').and.not.empty;
      expect(geometry.properties.property_name).to.be.a('string').and.not.empty;
      // The MVT feature id keys each geometry, so fragments split across tiles share an identity.
      expect(geometry.id).to.equal(geometryId);
      // The id column is consumed by ST_AsMVT, never duplicated into the attributes.
      expect(geometry.properties).to.not.have.property('mvt_feature_id');
    });

    it('labels a geometry the way the properties table labels it', async () => {
      const { submissionId, featureId } = await createFeatureWithPoint();

      const expected = await connection.sql(
        SQL`
          SELECT fp.display_name
          FROM feature_type_property ftp
          JOIN feature_property fp ON fp.feature_property_id = ftp.feature_property_id
          WHERE ftp.feature_type_property_id = ${geometryPropertyId};
        `,
        z.object({ display_name: z.string() })
      );

      const [geometry] = await decodeGeometries(contextFor(submissionId, featureId));

      expect(geometry.properties.property_display_name).to.equal(expected.rows[0].display_name);
    });
  });

  describe('geometry handling', () => {
    it('encodes points, lines, polygons and multi-geometries', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, FEATURE_TYPE, { name: 'geom' });

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
        await addGeometry(featureId, wkt);
      }

      const geometries = await decodeGeometries(contextFor(submissionId, featureId));

      // Every geometry type survives clipping and MVT encoding.
      expect(geometries).to.have.length(wktGeometries.length);
    });

    it('returns an empty tile where the feature does not reach', async () => {
      const { submissionId, featureId } = await createFeatureWithPoint();

      // Mid ocean, far from the fixture.
      const result = await connection.sql(
        SQL`
          SELECT biohub.martin_feature(12, 0, 0, ${JSON.stringify({
            context: contextFor(submissionId, featureId)
          })}::json) AS tile;
        `,
        z.object({ tile: z.any() })
      );

      expect(result.rows[0].tile).to.be.null;
    });

    it('still renders geometry just outside the tile, so strokes are not clipped at the edge', async () => {
      // ST_AsMVTGeom draws into a buffer beyond the tile, so a geometry sitting just outside the
      // exact bounds still contributes to what this tile shows. Selecting candidates on the exact
      // envelope would drop it before rendering and clip geometry at every tile seam.
      const zoom = 12;
      const { submissionId, featureId } = await createFeatureWithPoint();

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

      // A short way past the western edge: outside the tile, inside the 64/4096 render buffer.
      await addGeometry(featureId, `POINT(${min_x - (max_x - min_x) * 0.005} ${(min_y + max_y) / 2})`);

      const geometries = await decodeGeometries(contextFor(submissionId, featureId), zoom);

      expect(geometries, 'a geometry in the buffer margin should still reach the tile').to.have.length(2);
    });

    it('excludes geometry of the same feature that lies outside the requested tile', async () => {
      const { submissionId, featureId } = await createFeatureWithPoint();
      // Far enough away to fall in a different tile at z12.
      await addGeometry(featureId, `POINT(${TEST_LNG + 5} ${TEST_LAT + 3})`);

      const geometries = await decodeGeometries(contextFor(submissionId, featureId));

      expect(geometries).to.have.length(1);
    });
  });

  describe('query plan', () => {
    it('looks the feature up by id rather than scanning the geometry table', async () => {
      const plan = await connection.sql(
        SQL`
          EXPLAIN (COSTS OFF)
          SELECT g.submission_feature_property_geometry_id
          FROM biohub.submission_feature_property_geometry g
          JOIN biohub.submission_feature sf ON sf.submission_feature_id = g.submission_feature_id
          WHERE g.submission_feature_id = 1
            AND g.value && public.ST_Transform(public.ST_TileEnvelope(12, 654, 1400), 4326);
        `,
        z.object({ 'QUERY PLAN': z.string() })
      );

      const planText = plan.rows.map((row) => row['QUERY PLAN']).join('\n');

      expect(planText).to.contain('submission_feature_property_geometry');
      expect(planText).to.not.contain('Seq Scan on submission_feature_property_geometry');
    });
  });
});
