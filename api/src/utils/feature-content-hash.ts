import { createHash } from 'node:crypto';
import { IFlattenedBlock } from '../models/submission-feature';

/**
 * Compute the deterministic content hash of a submitted feature.
 *
 * The hash identifies whether the meaningful submitted content of a feature changed
 * between uploads: repeated uploads compare the incoming hash against the stored
 * `submission_feature.content_hash` of the published row with the same
 * (submission_id, feature_type_id, source_id) to classify the feature as unchanged
 * or superseded.
 *
 * Canonical form (the normative spec):
 * - The hashed object is `{ type, parent, content, properties }` from the submitted
 *   block. The feature's own `id` (its source id) is excluded — identity is carried
 *   by the reconciliation key, the hash covers content only. Database-generated
 *   values (ids, uuids, upload ids, timestamps, lifecycle dates, derived rows) are
 *   structurally absent from the input.
 * - `parent` is the parent's source id, normalized to `null` when absent.
 * - `content` (feature references by source id) is sorted lexicographically: it is an
 *   unordered relationship set.
 * - Each top-level `properties.<key>` array is sorted by the canonical serialization
 *   of its elements: multi-value properties are stored as unordered typed rows.
 *   Arrays nested deeper are NOT sorted (e.g. GeoJSON `coordinates` are
 *   order-semantic).
 * - Serialization is canonical JSON: object keys sorted recursively, no whitespace,
 *   numbers as their `JSON.stringify` output (the input has round-tripped through
 *   `JSON.parse`, matching the jsonb semantics of the stored `data` column), object
 *   entries with `undefined` values dropped and `undefined` array elements emitted
 *   as `null` (mirroring `JSON.stringify`).
 * - Geometry is not semantically normalized: differently-encoded but equivalent
 *   geometries hash differently and classify as superseded rather than unchanged —
 *   an extra version, never a missed update.
 *
 * @export
 * @param {IFlattenedBlock} feature The submitted feature block.
 * @return {*} {string} SHA-256 hex digest (64 characters) of the canonical form.
 */
export function computeSubmissionFeatureContentHash(feature: IFlattenedBlock): string {
  const canonical = {
    content: [...(feature.content ?? [])].sort(),
    parent: feature.parent ?? null,
    properties: normalizeTopLevelPropertyArrays(feature.properties ?? {}),
    type: feature.type
  };

  return createHash('sha256').update(serializeCanonicalJson(canonical), 'utf8').digest('hex');
}

/**
 * Return a copy of a properties object with each top-level array value sorted by the
 * canonical serialization of its elements. Non-array values and deeper arrays are
 * left untouched.
 *
 * @param {Record<string, unknown>} properties The submitted feature properties.
 * @return {*} {Record<string, unknown>} Properties with order-insensitive top-level arrays.
 */
function normalizeTopLevelPropertyArrays(properties: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};

  for (const key of Object.keys(properties)) {
    const value = properties[key];
    normalized[key] = Array.isArray(value)
      ? value
          .map((item) => ({ item, serialized: serializeCanonicalJson(item) }))
          .sort((a, b) => (a.serialized < b.serialized ? -1 : a.serialized > b.serialized ? 1 : 0))
          .map(({ item }) => item)
      : value;
  }

  return normalized;
}

/**
 * Serialize a JSON-compatible value to canonical JSON: object keys sorted recursively,
 * no whitespace, `undefined` object entries dropped and `undefined` array elements
 * emitted as `null` (mirroring `JSON.stringify` semantics).
 *
 * @param {unknown} value The value to serialize.
 * @return {*} {string} The canonical JSON string.
 */
function serializeCanonicalJson(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => serializeCanonicalJson(item)).join(',')}]`;
  }

  if (typeof value === 'object') {
    const entries = Object.keys(value as Record<string, unknown>)
      .sort()
      .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${serializeCanonicalJson((value as Record<string, unknown>)[key])}`);

    return `{${entries.join(',')}}`;
  }

  return JSON.stringify(value);
}
