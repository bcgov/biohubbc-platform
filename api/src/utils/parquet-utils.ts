/**
 * Utility functions for generating Parquet files from feature data.
 *
 * Used by the download pipeline to convert typed feature properties into
 * GeoParquet-compliant files. Each feature type produces its own Parquet file
 * with a schema derived from `feature_type_property` definitions.
 *
 * Companion to csv-utils.ts — shares `CsvPropertyDefinition` for schema metadata.
 */
import { ParquetSchema, type FieldDefinition, type SchemaDefinition } from '@dsnp/parquetjs';

import {
  assertNoDatetimeColumnCollisions,
  DATETIME_DATE_SUFFIX,
  DATETIME_TIME_SUFFIX
} from '../models/datetime-column';
import { ParquetFeatureData } from '../models/download';
import type { CsvPropertyDefinition } from './csv-utils';

/**
 * Output column spec produced by expanding a single feature property definition.
 *
 * Most property types map 1:1 (one property -> one column). `datetime`
 * expands to two — see {@link expandPropertyToColumns}.
 */
export interface FeatureColumnSpec {
  name: string;
  parquetType: FieldDefinition['type'];
}

/**
 * Expand a feature property definition into one or more output column specs.
 *
 * Most property types map 1:1 to a single output column. `datetime` is the
 * exception: it expands into `<name>_date` (Parquet `DATE` — INT32 days-since-
 * epoch) and `<name>_time` (Parquet `TIME_MILLIS` — INT32 ms-since-midnight)
 * so partial-component values (date-only, time-only, or both) round-trip
 * losslessly and remain filterable as native columnar predicates in DuckDB,
 * pandas, and GIS tools.
 *
 * Parquet/CSV are themselves query substrates: a single combined ISO string
 * would force every consumer to parse before filtering, defeating columnar
 * query plans and discarding partial-component data that the underlying DB
 * stores as first-class (the `submission_feature_property_timestamp` table
 * holds nullable `date_value` / `time_value` columns with a CHECK that at
 * least one is set). UTF8 strings would force per-row CAST in DuckDB and
 * break per-row-group min/max predicate pushdown — choosing native logical
 * types preserves both. CSV remains UTF8 because CSV is untyped at the
 * format level.
 *
 * The `_date` / `_time` suffixes are imported from `models/datetime-column`
 * and shared with the SQL projection in `download-repository.ts`. The two
 * sites must produce identical names for the same input property — a drift
 * silently nulls cells. Conversion from the SQL projection's ISO strings to
 * the writer's expected primitives happens in `featureToRow` via
 * `dateStringToParquet` and `timeStringToMillis`.
 *
 * @param prop - Feature property definition (name + type).
 * @returns Array of column specs. Single-element for non-datetime types;
 *   two-element (`<name>_date`, `<name>_time`) for datetime.
 */
export function expandPropertyToColumns(prop: CsvPropertyDefinition): FeatureColumnSpec[] {
  if (prop.feature_property_type_name === 'datetime') {
    // Native Parquet logical types — DATE (INT32 days-since-epoch) and TIME_MILLIS
    // (INT32 ms-since-midnight). DuckDB / pandas / arrow read these as native
    // `date` / `time` columns with predicate pushdown via per-row-group min/max
    // statistics. UTF8 strings would force consumers to CAST per row and break
    // statistics-driven row-group skipping (the whole point of Parquet as a
    // query substrate). Conversion from the SQL projection's ISO strings happens
    // in `featureToRow` via `dateStringToParquet` / `timeStringToMillis`.
    return [
      { name: `${prop.feature_property_name}${DATETIME_DATE_SUFFIX}`, parquetType: 'DATE' },
      { name: `${prop.feature_property_name}${DATETIME_TIME_SUFFIX}`, parquetType: 'TIME_MILLIS' }
    ];
  }
  return [
    {
      name: prop.feature_property_name,
      parquetType: propertyTypeToParquetType(prop.feature_property_type_name)
    }
  ];
}

/**
 * Convert a `'YYYY-MM-DD'` string to a `Date` instance for `@dsnp/parquetjs`'s
 * DATE writer. The library accepts a `Date` and converts internally to days-
 * since-epoch (`getTime() / 86_400_000`). Constructed at UTC midnight so the
 * conversion is deterministic regardless of host timezone.
 *
 * @param s ISO date string in `'YYYY-MM-DD'` format, exactly as the SQL
 *   projection emits via `to_char(date_value, 'YYYY-MM-DD')`.
 * @returns A `Date` at the corresponding UTC midnight.
 */
export function dateStringToParquet(s: string): Date {
  return new Date(`${s}T00:00:00Z`);
}

/**
 * Convert a `'HH:MM:SS'` string to milliseconds-since-midnight for
 * `@dsnp/parquetjs`'s TIME_MILLIS writer (INT32, valid range 0–86_399_999).
 *
 * Postgres `time without time zone` accepts the literal `'24:00:00'` as ISO
 * 8601 nominal end-of-day. The Parquet TIME_MILLIS spec doesn't define a
 * value at exactly 86_400_000 ms, and downstream readers (DuckDB, Arrow,
 * pandas) handle the boundary inconsistently — accept, clip, or throw.
 * We clamp at `86_399_999` so the cell stays in the de facto valid range.
 * The 1 ms loss preserves "near end of day" semantics rather than wrapping
 * to `00:00:00`, and the source Postgres value is unaffected.
 *
 * @param s 24-hour time string in `'HH:MM:SS'` format, exactly as the SQL
 *   projection emits via `to_char(time_value, 'HH24:MI:SS')`.
 * @returns Milliseconds since midnight, clamped to `86_399_999`.
 */
export function timeStringToMillis(s: string): number {
  const [hh, mm, ss] = s.split(':').map(Number);
  const ms = (hh * 3600 + mm * 60 + ss) * 1000;
  return Math.min(ms, 86_399_999);
}

/**
 * Maps a feature property type name to a Parquet field type.
 *
 * The platform stores feature properties in typed tables (`submission_feature_property_string`,
 * `_number`, etc.). This function bridges those type names to Parquet column types so
 * downstream consumers (DuckDB, QGIS, pandas) get native typed columns instead of strings.
 *
 * `array`, `object`, and `artifact_key` types have dynamic internal structure (arrays of
 * objects, nested JSON, file paths). No typed table exists for them — they fall back to
 * UTF8 (JSON-stringified) for Parquet output. `spatial` maps to BYTE_ARRAY for WKB encoding.
 *
 * @param typeName - The feature property type name from `feature_type_property`.
 * @returns The Parquet type string.
 */
export function propertyTypeToParquetType(typeName: string): FieldDefinition['type'] {
  switch (typeName) {
    case 'string':
      return 'UTF8';
    case 'number':
      return 'DOUBLE';
    case 'boolean':
      return 'BOOLEAN';
    case 'datetime':
      // `datetime` cannot map to a single primitive — it splits into two columns
      // (DATE + TIME_MILLIS) via `expandPropertyToColumns`. Reaching this case is
      // a programming error: a caller bypassed the helper and asked for a single
      // type. Fail loudly so the wrong column shape doesn't quietly land in the
      // Parquet footer as UTF8.
      throw new Error(
        `propertyTypeToParquetType: 'datetime' has no single Parquet type — use expandPropertyToColumns to get DATE + TIME_MILLIS`
      );
    case 'code':
      // Code properties arrive pre-resolved: the cursor JOIN resolves FK -> display label
      return 'UTF8';
    case 'taxon':
      // Taxon properties arrive pre-resolved: the cursor JOIN resolves taxon_id -> scientific name
      return 'UTF8';
    case 'spatial':
      // GeoParquet WKB-encoded geometry — each spatial property gets its own BYTE_ARRAY column
      return 'BYTE_ARRAY';
    case 'array':
      // Dynamic internal structure — JSON-stringified for Parquet output
      return 'UTF8';
    case 'object':
      // Dynamic internal structure — JSON-stringified for Parquet output
      return 'UTF8';
    case 'artifact_key':
      // File path string — no special encoding needed
      return 'UTF8';
    default:
      return 'UTF8';
  }
}

/**
 * Builds a @dsnp/parquetjs schema for a single feature type's Parquet file.
 *
 * Different feature types have different column schemas — each Parquet file contains
 * one feature type only. Every file includes a nullable `parent_uuid` column for
 * star-schema joins between files. Root types (e.g., dataset) will have null values;
 * child types will have the parent feature's UUID.
 *
 * Spatial properties each get their own BYTE_ARRAY column (WKB-encoded) using the
 * property's actual name. This supports feature types with multiple spatial properties
 * (e.g. `geometry` + `centroid`) without data loss.
 *
 * @param properties - Schema property definitions from `feature_type_property`.
 * @returns A ParquetSchema instance ready for writer construction.
 */
export function buildParquetSchema(properties: CsvPropertyDefinition[]): ParquetSchema {
  assertNoDatetimeColumnCollisions(properties);

  const fields: SchemaDefinition = {};

  // Every Parquet file includes the feature UUID for cross-file joins
  fields['uuid'] = { type: 'UTF8', optional: false };

  // Every file includes parent_uuid for star-schema joins. Root types (dataset)
  // will have null values; child types link back to the parent feature type's file.
  // Always present so consumers don't need to know which types are roots.
  fields['parent_uuid'] = { type: 'UTF8', optional: true };

  // The DB integer PK for the row. Carried alongside `uuid` because it's the
  // identifier the platform's UI exposes — the feature-detail route is
  // `/submission/:submissionId/feature/:submissionFeatureId`. Downstream
  // consumers (CSV export, DuckDB, pandas) use it both to namespace artifact
  // filenames (avoiding `0_*.bin` collisions when many rows reference files)
  // and as a clickable trace back into the platform.
  fields['submission_feature_id'] = { type: 'INT64', optional: false };

  for (const prop of properties) {
    for (const col of expandPropertyToColumns(prop)) {
      fields[col.name] = { type: col.parquetType, optional: true };
    }
  }

  return new ParquetSchema(fields);
}

/**
 * Converts a ParquetFeatureData row to a plain object for `writer.appendRow()`.
 *
 * Each entity type's Parquet file contains only its own columns plus `parent_uuid`.
 * This star-schema design keeps files independent for artifact caching and allows
 * GIS tools to join parent/child as needed — no flattened denormalization.
 *
 * Code and taxon properties arrive pre-resolved in `feature.data` — the cursor JOIN
 * (Phase 2) resolves FK to label/name before this function sees the data.
 *
 * @param feature - The feature row from the download cursor.
 * @param properties - Schema property definitions for this feature type.
 * @returns A plain object suitable for `ParquetWriter.appendRow()`.
 */
export function featureToRow(
  feature: ParquetFeatureData,
  properties: CsvPropertyDefinition[]
): Record<string, unknown> {
  const row: Record<string, unknown> = {};

  row['uuid'] = feature.uuid;
  row['parent_uuid'] = feature.parent_uuid ?? null;
  row['submission_feature_id'] = feature.submission_feature_id;

  for (const prop of properties) {
    if (prop.feature_property_type_name === 'datetime') {
      // `datetime` expands into two native Parquet columns: DATE (INT32 days-
      // since-epoch) and TIME_MILLIS (INT32 ms-since-midnight). The hydrator
      // wrote canonical ISO strings under `<prop>_date` / `<prop>_time` keys
      // (one or both may be null per the DB CHECK); convert each non-null
      // string to the writer's expected primitive. See `expandPropertyToColumns`
      // for why this is two columns rather than one combined timestamp.
      const dateKey = `${prop.feature_property_name}${DATETIME_DATE_SUFFIX}`;
      const timeKey = `${prop.feature_property_name}${DATETIME_TIME_SUFFIX}`;
      const dateStr = feature.data[dateKey];
      const timeStr = feature.data[timeKey];
      row[dateKey] = typeof dateStr === 'string' ? dateStringToParquet(dateStr) : null;
      row[timeKey] = typeof timeStr === 'string' ? timeStringToMillis(timeStr) : null;
      continue;
    }

    const value = feature.data[prop.feature_property_name];

    if (value == null) {
      row[prop.feature_property_name] = null;
      continue;
    }

    switch (prop.feature_property_type_name) {
      case 'spatial': {
        const geometry = extractGeoJsonGeometry(value);
        row[prop.feature_property_name] = geometry ? geoJsonToWkb(geometry) : null;
        break;
      }
      case 'array':
        row[prop.feature_property_name] = JSON.stringify(value);
        break;
      case 'object':
        row[prop.feature_property_name] = JSON.stringify(value);
        break;
      default:
        // string, number, boolean, code, taxon, artifact_key — pass through directly
        row[prop.feature_property_name] = value;
        break;
    }
  }

  return row;
}

/**
 * Converts GeoJSON geometry to WKB (Well-Known Binary) bytes.
 *
 * GeoParquet spec requires WKB geometry encoding. CRS is EPSG:4326 (WGS 84).
 * WKB is chosen over native point encoding because data includes Polygons,
 * MultiPolygons, LineStrings, and other complex geometry types.
 *
 * Encodes in little-endian (byte order 0x01) with 2D coordinates.
 * Supported types: Point, LineString, Polygon, MultiPoint, MultiLineString,
 * MultiPolygon, GeometryCollection.
 *
 * @param geoJson - A GeoJSON geometry object (or Feature/FeatureCollection wrapper).
 * @returns WKB Buffer, or null for null/undefined input.
 */
export function geoJsonToWkb(geoJson: unknown): Buffer | null {
  if (geoJson == null) {
    return null;
  }

  const geometry = extractGeoJsonGeometry(geoJson);
  if (!geometry) {
    return null;
  }

  return encodeGeometry(geometry);
}

/**
 * Extracts the geometry object from a GeoJSON value.
 *
 * Handles bare geometry objects, Feature wrappers, and FeatureCollection wrappers.
 * For FeatureCollection, returns the first feature's geometry.
 *
 * @param value - A GeoJSON value (geometry, Feature, or FeatureCollection).
 * @returns The geometry object, or null if none found.
 */
export function extractGeoJsonGeometry(value: unknown): GeoJsonGeometry | null {
  if (value == null || typeof value !== 'object') {
    return null;
  }

  const geo = value as Record<string, unknown>;

  // Bare geometry object
  if (isGeometryType(geo.type as string)) {
    // isGeometryType() already validated the shape — cast instead of copying to avoid
    // allocating a throwaway object for every feature in the download stream
    return geo as unknown as GeoJsonGeometry;
  }

  // Feature wrapper — unwrap to geometry
  if (geo.type === 'Feature') {
    return extractGeoJsonGeometry(geo.geometry);
  }

  // FeatureCollection — extract first feature's geometry
  if (geo.type === 'FeatureCollection' && Array.isArray(geo.features)) {
    for (const feature of geo.features) {
      const geometry = extractGeoJsonGeometry(feature);
      if (geometry) {
        return geometry;
      }
    }
  }

  return null;
}

/**
 * Returns the GeoParquet `geo` metadata key value.
 *
 * This JSON string is written as file-level metadata under the key "geo" to make
 * the Parquet file discoverable as GeoParquet by tools like QGIS, DuckDB Spatial,
 * and GeoPandas. The CRS declares EPSG:4326 (WGS 84) using PROJJSON format per
 * the GeoParquet 1.0.0 spec.
 *
 * Each spatial property gets its own column entry. The first spatial column is
 * designated as `primary_column` per the GeoParquet spec.
 *
 * `geometry_types` is left empty — the spec allows this, meaning "any type may appear."
 * This avoids needing a pre-scan of all geometries before writing.
 *
 * @param spatialColumnNames - Names of the spatial property columns in the Parquet file.
 * @returns JSON string for the "geo" file metadata key.
 */
export function buildGeoParquetMetadata(spatialColumnNames: string[]): string {
  const crs = {
    $schema: 'https://proj.org/schemas/v0.7/projjson.schema.json',
    type: 'GeographicCRS',
    name: 'WGS 84',
    datum: {
      type: 'GeodeticReferenceFrame',
      name: 'World Geodetic System 1984',
      ellipsoid: { name: 'WGS 84', semi_major_axis: 6378137, inverse_flattening: 298.257223563 }
    },
    coordinate_system: {
      subtype: 'ellipsoidal',
      axis: [
        { name: 'Geodetic latitude', abbreviation: 'Lat', direction: 'north', unit: 'degree' },
        { name: 'Geodetic longitude', abbreviation: 'Lon', direction: 'east', unit: 'degree' }
      ]
    },
    id: { authority: 'EPSG', code: 4326 }
  };

  const columns: Record<string, unknown> = {};
  for (const name of spatialColumnNames) {
    columns[name] = { encoding: 'WKB', geometry_types: [], crs };
  }

  return JSON.stringify({
    version: '1.0.0',
    primary_column: spatialColumnNames[0],
    columns
  });
}

// ---------------------------------------------------------------------------
// Internal types and helpers
// ---------------------------------------------------------------------------

/** Minimal GeoJSON geometry shape for WKB encoding. */
interface GeoJsonGeometry {
  type: string;
  coordinates?: unknown;
  geometries?: GeoJsonGeometry[];
}

/** WKB type codes (2D) per OGC 06-103r4. */
const WKB_TYPE = {
  Point: 1,
  LineString: 2,
  Polygon: 3,
  MultiPoint: 4,
  MultiLineString: 5,
  MultiPolygon: 6,
  GeometryCollection: 7
} as const;

const GEOMETRY_TYPES = new Set(Object.keys(WKB_TYPE));

function isGeometryType(type: string): boolean {
  return GEOMETRY_TYPES.has(type);
}

/**
 * Encode a GeoJSON geometry to a WKB Buffer (little-endian, 2D).
 */
function encodeGeometry(geom: GeoJsonGeometry): Buffer | null {
  const wkbType = WKB_TYPE[geom.type as keyof typeof WKB_TYPE];
  if (wkbType === undefined) {
    return null;
  }

  switch (geom.type) {
    case 'Point':
      return encodePoint(geom.coordinates as [number, number]);
    case 'LineString':
      return encodeLineString(geom.coordinates as [number, number][]);
    case 'Polygon':
      return encodePolygon(geom.coordinates as [number, number][][]);
    case 'MultiPoint':
      return encodeMulti(
        WKB_TYPE.MultiPoint,
        (geom.coordinates as [number, number][]).map((c) => encodePoint(c))
      );
    case 'MultiLineString':
      return encodeMulti(
        WKB_TYPE.MultiLineString,
        (geom.coordinates as [number, number][][]).map((c) => encodeLineString(c))
      );
    case 'MultiPolygon':
      return encodeMulti(
        WKB_TYPE.MultiPolygon,
        (geom.coordinates as [number, number][][][]).map((c) => encodePolygon(c))
      );
    case 'GeometryCollection':
      return encodeMulti(
        WKB_TYPE.GeometryCollection,
        (geom.geometries ?? []).map((g) => encodeGeometry(g)).filter(Boolean) as Buffer[]
      );
    default:
      return null;
  }
}

/** WKB header: 1 byte order + 4 byte type = 5 bytes. */
function writeHeader(buf: Buffer, offset: number, wkbType: number): number {
  buf.writeUInt8(1, offset); // little-endian
  buf.writeUInt32LE(wkbType, offset + 1);
  return offset + 5;
}

function encodePoint(coords: [number, number]): Buffer {
  // 1 (byte order) + 4 (type) + 8 (x) + 8 (y) = 21 bytes
  const buf = Buffer.alloc(21);
  let offset = writeHeader(buf, 0, WKB_TYPE.Point);
  buf.writeDoubleLE(coords[0], offset);
  buf.writeDoubleLE(coords[1], offset + 8);
  return buf;
}

function encodeLineString(coords: [number, number][]): Buffer {
  // header (5) + numPoints (4) + points (16 each)
  const buf = Buffer.alloc(5 + 4 + coords.length * 16);
  let offset = writeHeader(buf, 0, WKB_TYPE.LineString);
  buf.writeUInt32LE(coords.length, offset);
  offset += 4;
  for (const [x, y] of coords) {
    buf.writeDoubleLE(x, offset);
    buf.writeDoubleLE(y, offset + 8);
    offset += 16;
  }
  return buf;
}

function encodeRing(coords: [number, number][]): Buffer {
  // numPoints (4) + points (16 each)
  const buf = Buffer.alloc(4 + coords.length * 16);
  buf.writeUInt32LE(coords.length, 0);
  let offset = 4;
  for (const [x, y] of coords) {
    buf.writeDoubleLE(x, offset);
    buf.writeDoubleLE(y, offset + 8);
    offset += 16;
  }
  return buf;
}

function encodePolygon(rings: [number, number][][]): Buffer {
  const ringBuffers = rings.map(encodeRing);
  const bodySize = ringBuffers.reduce((sum, rb) => sum + rb.length, 0);
  // header (5) + numRings (4) + ring data
  const buf = Buffer.alloc(5 + 4 + bodySize);
  let offset = writeHeader(buf, 0, WKB_TYPE.Polygon);
  buf.writeUInt32LE(rings.length, offset);
  offset += 4;
  for (const rb of ringBuffers) {
    rb.copy(buf, offset);
    offset += rb.length;
  }
  return buf;
}

function encodeMulti(wkbType: number, children: Buffer[]): Buffer {
  const bodySize = children.reduce((sum, c) => sum + c.length, 0);
  // header (5) + numGeometries (4) + child WKB data
  const buf = Buffer.alloc(5 + 4 + bodySize);
  let offset = writeHeader(buf, 0, wkbType);
  buf.writeUInt32LE(children.length, offset);
  offset += 4;
  for (const child of children) {
    child.copy(buf, offset);
    offset += child.length;
  }
  return buf;
}
