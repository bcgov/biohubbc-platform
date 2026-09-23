/**
 * Shared helpers for integration tests that exercise a Martin tile function directly against the database:
 * attaching geometries to fixtures, rendering the tile that contains a point, and decoding the MVT that comes back.
 *
 * All functions accept an IDBConnection (transaction-scoped) so they participate in the test's rollback isolation.
 */
import { VectorTile } from '@mapbox/vector-tile';
import { expect } from 'chai';
import Protobuf from 'pbf';
import SQL, { SQLStatement } from 'sql-template-strings';
import { z } from 'zod';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { featureTypeIdByName } from './test-feature-property-helpers';

/** Tile functions these helpers can render. The name selects a fixed SQL fragment; it is never interpolated. */
export type MartinTileFunction = 'martin_feature' | 'martin_upload';

const TILE_FUNCTION_CALLS: Record<MartinTileFunction, string> = {
  martin_feature: 'biohub.martin_feature(t.z, t.x, t.y, ',
  martin_upload: 'biohub.martin_upload(t.z, t.x, t.y, '
};

/** What a tile function suite needs from the database: a transaction-scoped connection and the fixture catalog ids. */
export interface TileFunctionFixture {
  /** The suite's connection. Opened before each test and rolled back after it. */
  readonly connection: IDBConnection;
  /** The feature type the fixtures are created as. */
  readonly featureTypeId: number;
  /** A spatial property of that feature type, which geometries are recorded against. */
  readonly geometryAssignmentId: number;
}

/**
 * Register the mocha hooks a tile function suite needs: a pooled connection opened before each test and rolled back
 * after it, so no fixture is persisted, plus the id of the fixture feature type and the default Blueprint's assignment
 * of one of its spatial properties. Call it once at the top of the `describe`; the returned getters read the current test's values.
 *
 * @param {string} featureTypeName - Feature type the fixtures are created as. Any type with a spatial property will do.
 * @return {TileFunctionFixture}
 */
export function useTileFunctionFixture(featureTypeName: string): TileFunctionFixture {
  let connection: IDBConnection;
  let featureTypeId: number;
  let geometryAssignmentId: number;

  before(() => {
    initDBPool(defaultPoolConfig);
  });

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();

    featureTypeId = await featureTypeIdByName(connection, featureTypeName);

    const spatialAssignmentId = await findSpatialAssignmentId(connection, featureTypeId);
    expect(spatialAssignmentId, 'fixture feature type needs a spatial property').to.be.a('number');
    geometryAssignmentId = spatialAssignmentId as number;
  });

  afterEach(async () => {
    await connection.rollback();
    connection.release();
  });

  return {
    get connection() {
      return connection;
    },
    get featureTypeId() {
      return featureTypeId;
    },
    get geometryAssignmentId() {
      return geometryAssignmentId;
    }
  };
}

/** A point in BC that the tile fixtures are placed at. */
export const TILE_TEST_POINT = { lng: -123.36, lat: 48.43 };

/** One decoded MVT feature: its MVT feature id plus decoded properties. */
export interface DecodedTileFeature {
  id: number | undefined;
  properties: Record<string, unknown>;
}

/**
 * Find the active default Blueprint's assignment of a geometry-valued property to a feature type.
 * Geometry-valued properties are typed 'spatial' in the property catalog. Returns null when the type has
 * no (other) spatial property assigned. Fixtures are uploaded under the active default Blueprint, so this
 * is the assignment their geometry rows must carry.
 *
 * @param {IDBConnection} connection
 * @param {number} featureTypeId
 * @param {number} [excludeAssignmentId] - An assignment to skip, to find a second spatial property.
 * @return {Promise<number | null>} The blueprint_feature_type_property id, or null.
 */
export async function findSpatialAssignmentId(
  connection: IDBConnection,
  featureTypeId: number,
  excludeAssignmentId?: number
): Promise<number | null> {
  const sqlStatement = SQL`
    SELECT bftp.blueprint_feature_type_property_id
    FROM blueprint b
    JOIN blueprint_feature_type bft ON bft.blueprint_id = b.blueprint_id
    JOIN blueprint_feature_type_property bftp ON bftp.blueprint_feature_type_id = bft.blueprint_feature_type_id
    JOIN feature_property fp ON fp.feature_property_id = bftp.feature_property_id
    JOIN feature_property_type fpt ON fpt.feature_property_type_id = fp.feature_property_type_id
    WHERE b.is_default = true
      AND b.record_end_date IS NULL
      AND bft.feature_type_id = ${featureTypeId}
      AND bft.record_end_date IS NULL
      AND bftp.record_end_date IS NULL
      AND fpt.name = 'spatial'
  `;

  if (excludeAssignmentId !== undefined) {
    sqlStatement.append(SQL` AND bftp.blueprint_feature_type_property_id <> ${excludeAssignmentId}`);
  }

  sqlStatement.append(SQL` ORDER BY bftp.blueprint_feature_type_property_id LIMIT 1;`);

  const result = await connection.sql(sqlStatement, z.object({ blueprint_feature_type_property_id: z.number() }));

  return result.rows[0]?.blueprint_feature_type_property_id ?? null;
}

/**
 * Attach a geometry (as WKT, in WGS84) to a feature, returning the new row's id.
 *
 * @param {IDBConnection} connection
 * @param {number} submissionFeatureId
 * @param {number} blueprintFeatureTypePropertyId - The spatial property assignment the value is recorded against.
 * @param {string} wkt
 * @return {Promise<number>} The submission_feature_property_geometry id.
 */
export async function addTestGeometry(
  connection: IDBConnection,
  submissionFeatureId: number,
  blueprintFeatureTypePropertyId: number,
  wkt: string
): Promise<number> {
  const result = await connection.sql(
    SQL`
      INSERT INTO submission_feature_property_geometry (submission_feature_id, blueprint_feature_type_property_id, value, create_user)
      VALUES (
        ${submissionFeatureId},
        ${blueprintFeatureTypePropertyId},
        public.ST_SetSRID(public.ST_GeomFromText(${wkt}), 4326),
        ${connection.systemUserId()}
      )
      RETURNING submission_feature_property_geometry_id;
    `,
    z.object({ submission_feature_property_geometry_id: z.number() })
  );

  return result.rows[0].submission_feature_property_geometry_id;
}

/**
 * SQL that computes the tile coordinates containing a point at a zoom, as a CTE named `t` with columns z, x, y.
 */
function tileCoordinatesCte(lng: number, lat: number, zoom: number): SQLStatement {
  return SQL`
    WITH t AS (
      SELECT
        ${zoom}::integer AS z,
        floor((${lng}::double precision + 180.0) / 360.0 * (2 ^ ${zoom}))::integer AS x,
        floor(
          (1.0 - ln(tan(radians(${lat}::double precision)) + 1.0 / cos(radians(${lat}::double precision))) / pi())
          / 2.0 * (2 ^ ${zoom})
        )::integer AS y
    )
  `;
}

/**
 * Ask a tile function for the tile containing a point, and return the raw MVT bytes (null for an empty tile).
 *
 * @param {IDBConnection} connection
 * @param {MartinTileFunction} tileFunction
 * @param {string} context - The context string the gateway takes from the verified token.
 * @param {{ zoom?: number; lng?: number; lat?: number }} [options] - Defaults to zoom 12 at {@link TILE_TEST_POINT}.
 * @return {Promise<Buffer | null>}
 */
export async function renderTile(
  connection: IDBConnection,
  tileFunction: MartinTileFunction,
  context: string,
  options: { zoom?: number; lng?: number; lat?: number } = {}
): Promise<Buffer | null> {
  const { zoom = 12, lng = TILE_TEST_POINT.lng, lat = TILE_TEST_POINT.lat } = options;

  const sqlStatement = tileCoordinatesCte(lng, lat, zoom);

  sqlStatement.append(`SELECT ${TILE_FUNCTION_CALLS[tileFunction]}`);
  sqlStatement.append(SQL`${JSON.stringify({ context })}::json) AS tile FROM t;`);

  const result = await connection.sql(sqlStatement, z.object({ tile: z.instanceof(Buffer).nullable() }));

  return result.rows[0].tile;
}

/**
 * Decode an MVT into its layers.
 *
 * @param {Buffer} tile
 * @return {Record<string, DecodedTileFeature[]>} Features by layer name.
 */
export function decodeTile(tile: Buffer): Record<string, DecodedTileFeature[]> {
  const vectorTile = new VectorTile(new Protobuf(tile));
  const layers: Record<string, DecodedTileFeature[]> = {};

  for (const [name, layer] of Object.entries(vectorTile.layers)) {
    layers[name] = [];

    for (let index = 0; index < layer.length; index++) {
      const feature = layer.feature(index);
      layers[name].push({ id: feature.id, properties: feature.properties });
    }
  }

  return layers;
}

/**
 * Render the tile containing the test point and return its `geometries` layer, asserting the tile is not empty and
 * carries that layer alone.
 *
 * @param {IDBConnection} connection
 * @param {MartinTileFunction} tileFunction
 * @param {string} context
 * @param {number} [zoom=12]
 * @return {Promise<DecodedTileFeature[]>}
 */
export async function decodeGeometriesLayer(
  connection: IDBConnection,
  tileFunction: MartinTileFunction,
  context: string,
  zoom = 12
): Promise<DecodedTileFeature[]> {
  const tile = await renderTile(connection, tileFunction, context, { zoom });
  expect(tile, 'expected a non-empty tile').to.be.instanceOf(Buffer);

  const layers = decodeTile(tile as Buffer);
  expect(Object.keys(layers)).to.deep.equal(['geometries']);

  return layers.geometries;
}

/**
 * The WGS84 bounds of the tile containing a point at a zoom.
 *
 * @param {IDBConnection} connection
 * @param {number} zoom
 * @param {number} [lng]
 * @param {number} [lat]
 * @return {Promise<{ min_x: number; max_x: number; min_y: number; max_y: number }>}
 */
export async function tileBounds4326(
  connection: IDBConnection,
  zoom: number,
  lng = TILE_TEST_POINT.lng,
  lat = TILE_TEST_POINT.lat
): Promise<{ min_x: number; max_x: number; min_y: number; max_y: number }> {
  const sqlStatement = tileCoordinatesCte(lng, lat, zoom);

  sqlStatement.append(`
    SELECT
      public.ST_XMin(env) AS min_x,
      public.ST_XMax(env) AS max_x,
      public.ST_YMin(env) AS min_y,
      public.ST_YMax(env) AS max_y
    FROM (
      SELECT public.ST_Transform(public.ST_TileEnvelope(t.z, t.x, t.y), 4326) AS env FROM t
    ) e;
  `);

  const result = await connection.sql(
    sqlStatement,
    z.object({ min_x: z.number(), max_x: z.number(), min_y: z.number(), max_y: z.number() })
  );

  return result.rows[0];
}

/**
 * One WKT geometry of each type, anchored at a point. WKT so each geometry is passed as a bound parameter rather than
 * interpolated SQL.
 *
 * @param {number} [lng]
 * @param {number} [lat]
 * @return {string[]}
 */
export function buildWktGeometries(lng = TILE_TEST_POINT.lng, lat = TILE_TEST_POINT.lat): string[] {
  return [
    `POINT(${lng} ${lat})`,
    `LINESTRING(${lng} ${lat}, ${lng + 0.001} ${lat + 0.001})`,
    `POLYGON((${lng} ${lat}, ${lng + 0.001} ${lat}, ${lng + 0.001} ${lat + 0.001}, ${lng} ${lat}))`,
    `MULTIPOINT((${lng} ${lat}), (${lng + 0.0005} ${lat + 0.0005}))`,
    `MULTILINESTRING((${lng} ${lat}, ${lng + 0.001} ${lat + 0.001}))`,
    `MULTIPOLYGON(((${lng} ${lat}, ${lng + 0.001} ${lat}, ${lng + 0.001} ${lat + 0.001}, ${lng} ${lat})))`
  ];
}
