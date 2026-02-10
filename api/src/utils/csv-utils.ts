/**
 * Utility functions for generating CSV files from feature data.
 *
 * Used by the download pipeline to convert JSON feature data to CSV format.
 */

export interface CsvPropertyDefinition {
  feature_property_name: string;
  feature_property_type_name: string;
}

/**
 * Build CSV header names from schema property definitions.
 * Spatial properties expand to `decimalLatitude` and `decimalLongitude`.
 *
 * @param {CsvPropertyDefinition[]} properties - Schema property definitions.
 * @returns {string[]} Ordered header names.
 */
export function buildSchemaHeaders(properties: CsvPropertyDefinition[]): string[] {
  const headers: string[] = [];

  for (const prop of properties) {
    if (prop.feature_property_type_name === 'spatial') {
      headers.push('decimalLatitude', 'decimalLongitude');
    } else if (prop.feature_property_type_name === 'artifact_key') {
      headers.push('filePath');
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
 * - string, number, datetime, boolean → String(value)
 * - spatial → extract first Point from GeoJSON → decimalLatitude/decimalLongitude
 * - array → delegate to flattenArray()
 * - artifact_key → files/{submissionFeatureId}_{filename}
 * - object → JSON.stringify(value)
 * - null/undefined → empty string (spatial gets two empty strings)
 *
 * @param {Record<string, unknown>} data - The feature's JSONB data.
 * @param {CsvPropertyDefinition[]} properties - Schema property definitions.
 * @param {number} submissionFeatureId - The submission_feature_id for artifact_key paths.
 * @returns {Record<string, string>} Flattened key-value pairs keyed by header name.
 */
export function flattenFeatureBySchema(
  data: Record<string, unknown>,
  properties: CsvPropertyDefinition[],
  submissionFeatureId: number,
  filesFolderName = 'files'
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const prop of properties) {
    const value = data[prop.feature_property_name];

    switch (prop.feature_property_type_name) {
      case 'spatial':
        Object.assign(result, flattenSpatialValue(value));
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
 * Convert a value to string, or empty string if null/undefined.
 */
function toStringOrEmpty(value: unknown): string {
  if (value == null) {
    return '';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Flatten a spatial property to decimalLatitude/decimalLongitude.
 */
function flattenSpatialValue(value: unknown): Record<string, string> {
  const coords = extractFirstPointCoordinates(value);
  if (coords) {
    return { decimalLatitude: String(coords[1]), decimalLongitude: String(coords[0]) };
  }
  return { decimalLatitude: '', decimalLongitude: '' };
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
 * Extract the first Point coordinates from a GeoJSON value.
 * Handles bare Point, Feature wrapping Point, and FeatureCollection with Features.
 *
 * @param {unknown} value - The GeoJSON value.
 * @returns {[number, number] | null} [longitude, latitude] or null if no Point found.
 */
function extractFirstPointCoordinates(value: unknown): [number, number] | null {
  if (value == null || typeof value !== 'object') {
    return null;
  }

  const geo = value as Record<string, unknown>;

  if (geo.type === 'Point' && Array.isArray(geo.coordinates)) {
    return geo.coordinates as [number, number];
  }

  if (geo.type === 'Feature') {
    return extractFirstPointCoordinates(geo.geometry);
  }

  if (geo.type === 'FeatureCollection' && Array.isArray(geo.features)) {
    for (const feature of geo.features) {
      const coords = extractFirstPointCoordinates(feature);
      if (coords) {
        return coords;
      }
    }
  }

  return null;
}

/**
 * Flatten a nested object to a single-level object with dot-notation keys.
 * Arrays are converted to semicolon-separated strings.
 *
 * @example
 * flattenObject({ a: 1, b: { c: 2 }, d: [1, 2, 3] })
 * // Returns: { a: '1', b_c: '2', d: '1;2;3' }
 *
 * @param {Record<string, unknown>} obj - The object to flatten
 * @param {string} [prefix=''] - Key prefix for nested properties
 * @returns {Record<string, string>} Flattened object with string values
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
    return String(item);
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
    return `"${value.replaceAll('"', '""')}"`;
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
