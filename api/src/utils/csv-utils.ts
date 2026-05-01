/**
 * Utility functions for generating CSV files from feature data.
 *
 * Used by the download pipeline to convert JSON feature data to CSV format.
 */
import wkx from 'wkx';

import {
  assertNoDatetimeColumnCollisions,
  DATETIME_DATE_SUFFIX,
  DATETIME_TIME_SUFFIX
} from '../models/datetime-column';

export interface CsvPropertyDefinition {
  feature_property_name: string;
  feature_property_type_name: string;
}

/**
 * Build CSV header names from schema property definitions.
 *
 * Spatial properties emit a single column under the property's own name —
 * the cell value is WKT (decoded from the Parquet WKB buffer at flatten
 * time). artifact_key properties map to a single `filePath` column.
 *
 * `datetime` properties emit two columns (`<prop>_date`, `<prop>_time`) so
 * partial-component data (date-only, time-only, or both) round-trips
 * losslessly and remains queryable as native columnar predicates. The
 * suffix convention is shared with the SQL projection and the Parquet
 * column expansion — all three sites must agree on the names.
 *
 * @param {CsvPropertyDefinition[]} properties - Schema property definitions.
 * @returns {string[]} Ordered header names.
 */
export function buildSchemaHeaders(properties: CsvPropertyDefinition[]): string[] {
  assertNoDatetimeColumnCollisions(properties);

  const headers: string[] = [];

  for (const prop of properties) {
    if (prop.feature_property_type_name === 'artifact_key') {
      headers.push('filePath');
    } else if (prop.feature_property_type_name === 'datetime') {
      headers.push(`${prop.feature_property_name}${DATETIME_DATE_SUFFIX}`);
      headers.push(`${prop.feature_property_name}${DATETIME_TIME_SUFFIX}`);
    } else {
      headers.push(prop.feature_property_name);
    }
  }

  return headers;
}

/**
 * Build CSV headers combining parent and child schemas.
 * Order: system columns → parent properties → child properties
 *
 * @param {CsvPropertyDefinition[] | null} parentProperties - Schema for parent feature type (null if no parent)
 * @param {CsvPropertyDefinition[]} childProperties - Schema for child feature type
 * @param {string[]} systemHeaders - System columns to prepend (e.g., ['dataset_name', 'dataset_id'])
 * @returns {string[]} Combined header array
 */
export function buildCombinedHeaders(
  parentProperties: CsvPropertyDefinition[] | null,
  childProperties: CsvPropertyDefinition[],
  systemHeaders: string[] = []
): string[] {
  const headers = [...systemHeaders];

  if (parentProperties) {
    headers.push(...buildSchemaHeaders(parentProperties));
  }

  headers.push(...buildSchemaHeaders(childProperties));

  return headers;
}

/**
 * Flatten child feature data with parent data merged in.
 *
 * @param {Record<string, unknown>} childData - Child feature's JSONB data
 * @param {CsvPropertyDefinition[]} childProperties - Child's schema
 * @param {Record<string, unknown> | null} parentData - Parent feature's JSONB data (null if no parent)
 * @param {CsvPropertyDefinition[] | null} parentProperties - Parent's schema (null if no parent)
 * @param {number} submissionFeatureId - For artifact_key paths
 * @returns {Record<string, string>} Flattened record with parent columns + child columns
 */
export function flattenFeatureWithParent(
  childData: Record<string, unknown>,
  childProperties: CsvPropertyDefinition[],
  parentData: Record<string, unknown> | null,
  parentProperties: CsvPropertyDefinition[] | null,
  submissionFeatureId: number,
  filesFolderName = 'files'
): Record<string, string> {
  const result: Record<string, string> = {};

  // Flatten parent first (if exists)
  if (parentData && parentProperties) {
    const parentFlattened = flattenFeatureBySchema(parentData, parentProperties, submissionFeatureId, filesFolderName);
    Object.assign(result, parentFlattened);
  }

  // Flatten child (overwrites any collisions, though schemas should be distinct)
  const childFlattened = flattenFeatureBySchema(childData, childProperties, submissionFeatureId, filesFolderName);
  Object.assign(result, childFlattened);

  return result;
}

/**
 * Flatten a feature's JSONB data using schema-defined property types.
 *
 * Type-aware rules:
 * - string, number, boolean → String(value)
 * - datetime → expands to two cells (`<prop>_date`, `<prop>_time`); each
 *   pulled directly from the matching key on `data`. Partial-component data
 *   round-trips losslessly: a null component produces an empty cell while
 *   the other carries its ISO string. See {@link buildSchemaHeaders}.
 * - spatial → decode WKB Buffer (as produced by the Parquet writer) → single
 *   column under the property's own name, value is WKT
 * - array → delegate to flattenArray()
 * - artifact_key → files/{submissionFeatureId}_{filename}
 * - object → JSON.stringify(value)
 * - null/undefined → empty string
 *
 * @param data - The feature's JSONB data.
 * @param properties - Schema property definitions.
 * @param submissionFeatureId - The submission_feature_id for artifact_key paths.
 * @param filesFolderName - Subfolder name in the zip for artifact_key paths. Defaults to `'files'`.
 * @returns Flattened key-value pairs keyed by header name.
 */
export function flattenFeatureBySchema(
  data: Record<string, unknown>,
  properties: CsvPropertyDefinition[],
  submissionFeatureId: number,
  filesFolderName = 'files'
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const prop of properties) {
    if (prop.feature_property_type_name === 'datetime') {
      // The CSV is written from rows the Parquet reader returns. parquetjs reads
      // `DATE` columns as JS `Date` objects (UTC midnight on the stored day) and
      // `TIME_MILLIS` columns as raw millisecond integers. Both must be
      // formatted back into the canonical `'YYYY-MM-DD'` / `'HH:MM:SS'` strings
      // the SQL projection produced — otherwise the generic `toStringOrEmpty`
      // path would JSON-stringify the Date (`'"2026-04-24T00:00:00.000Z"'`)
      // and render the raw ms count for time. Strings still pass through
      // unchanged for callers that haven't gone through Parquet.
      const dateKey = `${prop.feature_property_name}${DATETIME_DATE_SUFFIX}`;
      const timeKey = `${prop.feature_property_name}${DATETIME_TIME_SUFFIX}`;
      result[dateKey] = formatDatetimeDateCell(data[dateKey]);
      result[timeKey] = formatDatetimeTimeCell(data[timeKey]);
      continue;
    }

    const value = data[prop.feature_property_name];

    switch (prop.feature_property_type_name) {
      case 'spatial':
        result[prop.feature_property_name] = wkbToWkt(value);
        break;
      case 'artifact_key':
        result['filePath'] = flattenArtifactKeyValue(value, data, submissionFeatureId, filesFolderName);
        break;
      case 'array':
        result[prop.feature_property_name] = Array.isArray(value) ? flattenArray(value) : toStringOrEmpty(value);
        break;
      case 'object':
        result[prop.feature_property_name] = value == null ? '' : JSON.stringify(value);
        break;
      default:
        result[prop.feature_property_name] = toStringOrEmpty(value);
        break;
    }
  }

  return result;
}

/**
 * Format a `<prop>_date` cell value for CSV output. parquetjs hands back a
 * `Date` (UTC midnight) for native `DATE` columns; the SQL projection emits a
 * `'YYYY-MM-DD'` string when CSV is fed directly without a Parquet round-trip.
 * Either form normalizes to the canonical date string. Null/undefined → empty.
 *
 * The Date branch matches the original SQL projection's
 * `to_char(date_value, 'YYYY-MM-DD')` output exactly — without it, the
 * generic `toStringOrEmpty` path would JSON-stringify the Date (`'"2026-04-24T00:00:00.000Z"'`).
 */
function formatDatetimeDateCell(value: unknown): string {
  if (value == null) {
    return '';
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value);
}

/**
 * Format a `<prop>_time` cell value for CSV output. parquetjs hands back a
 * raw millisecond integer for native `TIME_MILLIS` columns; the SQL projection
 * emits a `'HH:MM:SS'` string when CSV is fed directly. Either form normalizes
 * to the canonical time string. Null/undefined → empty.
 *
 * The number branch matches the original SQL projection's
 * `to_char(time_value, 'HH24:MI:SS')` output exactly — without it, the
 * generic `toStringOrEmpty` path would render the raw integer count
 * (e.g. `'45296000'`).
 */
function formatDatetimeTimeCell(value: unknown): string {
  if (value == null) {
    return '';
  }
  if (typeof value === 'number') {
    const totalSeconds = Math.floor(value / 1000);
    const hh = Math.floor(totalSeconds / 3600);
    const mm = Math.floor((totalSeconds % 3600) / 60);
    const ss = totalSeconds % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }
  return String(value);
}

/**
 * Convert a value to string, or empty string if null/undefined.
 */
function toStringOrEmpty(value: unknown): string {
  if (value == null) {
    return '';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value as string | number | boolean);
}

/**
 * Decode a WKB Buffer (as produced by the Parquet writer) into a WKT string.
 * Returns an empty string for null/undefined or any value that isn't a Buffer,
 * and swallows parse errors — a malformed geometry shouldn't fail the whole
 * CSV.
 */
function wkbToWkt(value: unknown): string {
  if (!Buffer.isBuffer(value)) {
    return '';
  }
  try {
    return wkx.Geometry.parse(value).toWkt();
  } catch {
    return '';
  }
}

/**
 * Flatten an artifact_key property to a zip-relative file path.
 */
function flattenArtifactKeyValue(
  value: unknown,
  data: Record<string, unknown>,
  submissionFeatureId: number,
  filesFolderName: string
): string {
  const rawValue = (value ?? data['file']) as string | undefined;
  if (!rawValue) {
    return '';
  }
  const fileName = rawValue.split('/').pop() || 'file';
  return `${filesFolderName}/${submissionFeatureId}_${fileName}`;
}

/**
 * Flatten a nested object to a single-level object with dot-notation keys.
 * Arrays are converted to semicolon-separated strings.
 *
 * @example
 * flattenObject({ a: 1, b: { c: 2 }, d: [1, 2, 3] })
 * // Returns: { a: '1', b_c: '2', d: '1;2;3' }
 *
 * @param obj - The object to flatten.
 * @param prefix - Key prefix for nested properties. Defaults to `''`.
 * @returns Flattened object with string values.
 */
export function flattenObject(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}_${key}` : key;

    if (value === null || value === undefined) {
      result[newKey] = '';
    } else if (Array.isArray(value)) {
      // Handle arrays: extract values and join with semicolons
      result[newKey] = flattenArray(value);
    } else if (typeof value === 'object') {
      // Recurse into nested objects
      const nested = flattenObject(value as Record<string, unknown>, newKey);
      Object.assign(result, nested);
    } else {
      // Primitive value
      result[newKey] = toStringOrEmpty(value);
    }
  }

  return result;
}

/**
 * Flatten an array to a semicolon-separated string.
 * For arrays of objects, extracts the first property value of each object.
 *
 * @example
 * flattenArray([1, 2, 3]) // Returns: '1;2;3'
 * flattenArray([{ taxon_id: 100 }, { taxon_id: 200 }]) // Returns: '100;200'
 *
 * @param {unknown[]} arr - The array to flatten
 * @returns {string} Semicolon-separated string
 */
export function flattenArray(arr: unknown[]): string {
  const values = arr.map((item) => {
    if (item == null) {
      return '';
    }
    if (typeof item === 'object' && !Array.isArray(item)) {
      // For objects, get all values and join them
      const objValues = Object.values(item as Record<string, unknown>);
      if (objValues.length === 1) {
        // Single property object like { taxon_id: 100 } -> '100'
        return toStringOrEmpty(objValues[0]);
      }
      // Multiple properties: join with colon
      return objValues.map((v) => toStringOrEmpty(v)).join(':');
    }
    return String(item as string | number | boolean);
  });

  return values.join(';');
}

/**
 * Escape a CSV field value.
 * Wraps in quotes if the value contains commas, quotes, or newlines.
 *
 * @param {string} value - The value to escape
 * @returns {string} Escaped value
 */
export function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    // Escape quotes by doubling them, then wrap in quotes
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Generate a CSV string from an array of flattened feature records.
 *
 * @param {Record<string, string>[]} records - Array of flattened records
 * @returns {string} CSV string with header row
 */
export function generateCsv(records: Record<string, string>[]): string {
  if (records.length === 0) {
    return '';
  }

  // Collect all unique headers across all records
  const headersSet = new Set<string>();
  for (const record of records) {
    for (const key of Object.keys(record)) {
      headersSet.add(key);
    }
  }

  // Sort headers alphabetically for consistent output
  const headers = Array.from(headersSet).sort((a, b) => a.localeCompare(b));

  // Generate header row
  const headerRow = headers.map(escapeCsvField).join(',');

  // Generate data rows
  const dataRows = records.map((record) => {
    return headers.map((header) => escapeCsvField(record[header] ?? '')).join(',');
  });

  return [headerRow, ...dataRows].join('\n');
}

/**
 * Group features by feature type name.
 *
 * @param {Array<{ feature_type_name: string; [key: string]: unknown }>} features - Features to group
 * @returns {Map<string, Array<{ feature_type_name: string; [key: string]: unknown }>>} Grouped features
 */
export function groupFeaturesByType<T extends { feature_type_name: string }>(features: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();

  for (const feature of features) {
    const typeName = feature.feature_type_name;
    if (!grouped.has(typeName)) {
      grouped.set(typeName, []);
    }
    grouped.get(typeName)!.push(feature);
  }

  return grouped;
}

/**
 * Get the output filename for a feature type.
 * Maps 'file' to 'multimedia.csv' for DwC-A alignment.
 *
 * @param {string} featureTypeName - The feature type name
 * @returns {string} Output filename
 */
export function getOutputFilename(featureTypeName: string): string {
  if (featureTypeName === 'file') {
    return 'multimedia.csv';
  }
  return `${featureTypeName}.csv`;
}
