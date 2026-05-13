import {
  ExpressionLogicalOperator,
  ExpressionPredicateOperator,
  ExpressionTreeExpression
} from 'interfaces/expression.interface';

const LOGICAL_OPERATORS: ReadonlySet<string> = new Set<ExpressionLogicalOperator>(['AND', 'OR']);

const PREDICATE_OPERATORS: ReadonlySet<string> = new Set<ExpressionPredicateOperator>([
  'Equals',
  'NotEquals',
  'Like',
  'ILike',
  'StartsWith',
  'EndsWith',
  'Contains',
  'GreaterThan',
  'GreaterThanOrEqual',
  'LessThan',
  'LessThanOrEqual',
  'Before',
  'After',
  'OnDate',
  'OnTime',
  'ParentOf',
  'ChildOf',
  'DescendsFrom',
  'AscendsFrom',
  'Within',
  'Intersects',
  'Exists'
]);

/**
 * Recursively stringifies a value with object keys sorted alphabetically.
 * Arrays are NOT reordered so that `clauses` ordering is preserved.
 * Produces deterministic JSON output — the same logical expression always
 * encodes to the same URL string.
 *
 * @param value - Any JSON-serializable value.
 * @returns A deterministic JSON string.
 */
export function stableStringify(value: unknown): string {
  const normalized = normalizeForStableStringify(value);
  return JSON.stringify(normalized) ?? 'null';
}

/**
 * Encodes a UTF-8 string to a base64url string (RFC 4648 §5).
 * Uses the `-_` alphabet instead of `+/` and omits `=` padding.
 *
 * @param str - A UTF-8 string to encode.
 * @returns A base64url-encoded string without padding.
 */
export function toBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCodePoint(b);
  });
  const b64 = btoa(binary).replaceAll('+', '-').replaceAll('/', '_');
  // base64 padding ('=') appears at the end only and is at most 2 chars; trim without regex
  const padStart = b64.indexOf('=');
  return padStart === -1 ? b64 : b64.slice(0, padStart);
}

/**
 * Decodes a base64url string (with or without `=` padding) back to a UTF-8 string.
 * Throws if the input is not valid base64url.
 *
 * @param encoded - A base64url-encoded string.
 * @returns The decoded UTF-8 string.
 */
export function fromBase64Url(encoded: string): string {
  // Restore standard base64: swap `-_` back to `+/` and re-add padding.
  const base64 = encoded
    .replaceAll('-', '+')
    .replaceAll('_', '/')
    .padEnd(encoded.length + ((4 - (encoded.length % 4)) % 4), '=');

  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (ch) => ch.codePointAt(0) ?? 0);
  return new TextDecoder().decode(bytes);
}

/**
 * Type guard that validates an unknown value as a well-formed `ExpressionTreeExpression`.
 *
 * Validates:
 * - Correct `type`, `operator`, and `clauses` shape on expression nodes.
 * - Correct `type`, `feature_property_id`, `feature_type_property_id`, and `operator` on predicate nodes.
 * - Rejects `ui_id` on any node (defense-in-depth; the serializer already strips it).
 *
 * @param value - The value to check.
 * @returns `true` when `value` is a valid `ExpressionTreeExpression`.
 */
export function isValidExpressionTree(value: unknown): value is ExpressionTreeExpression {
  return isValidExpression(value);
}

function isValidExpression(value: unknown): value is ExpressionTreeExpression {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const node = value as Record<string, unknown>;

  if (node['type'] !== 'expression') {
    return false;
  }

  if (!hasOnlyKeys(node, ['type', 'operator', 'clauses'])) {
    return false;
  }

  if ('ui_id' in node) {
    return false;
  }

  if (!LOGICAL_OPERATORS.has(node['operator'] as string)) {
    return false;
  }

  if (!Array.isArray(node['clauses'])) {
    return false;
  }

  if ((node['clauses'] as unknown[]).length === 0) {
    return false;
  }

  return (node['clauses'] as unknown[]).every(isValidClause);
}

function isValidClause(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const node = value as Record<string, unknown>;

  if (node['type'] === 'expression') {
    return isValidExpression(node);
  }

  if (node['type'] === 'predicate') {
    return isValidPredicate(node);
  }

  return false;
}

function isValidPredicate(node: Record<string, unknown>): boolean {
  if (!hasOnlyKeys(node, ['type', 'feature_property_id', 'feature_type_property_id', 'operator', 'value'])) {
    return false;
  }

  if ('ui_id' in node) {
    return false;
  }

  if (!isPositiveInteger(node['feature_property_id'])) {
    return false;
  }

  if (node['feature_type_property_id'] !== null && !isPositiveInteger(node['feature_type_property_id'])) {
    return false;
  }

  if (!PREDICATE_OPERATORS.has(node['operator'] as string)) {
    return false;
  }

  return true;
}

function normalizeForStableStringify(value: unknown): unknown {
  if (Array.isArray(value)) {
    // Preserve authored array order (for expression clause semantics).
    return value.map(normalizeForStableStringify);
  }

  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const sortedKeys = Object.keys(record).sort((a, b) => a.localeCompare(b));
    const normalizedEntries: [string, unknown][] = [];

    sortedKeys.forEach((key) => {
      const normalizedValue = normalizeForStableStringify(record[key]);

      // Match JSON.stringify behavior for objects: omit undefined-valued keys.
      if (normalizedValue !== undefined) {
        normalizedEntries.push([key, normalizedValue]);
      }
    });

    return Object.fromEntries(normalizedEntries);
  }

  return value;
}

function hasOnlyKeys(node: Record<string, unknown>, allowedKeys: string[]): boolean {
  const keys = Object.keys(node);
  return keys.every((key) => allowedKeys.includes(key));
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/**
 * Encodes an `ExpressionTreeExpression` into a URL-safe base64url string
 * suitable for the `expr` query parameter.
 *
 * Uses stable (deterministic) JSON serialization so the same expression always
 * produces the same encoded value.
 *
 * @param tree - A validated `ExpressionTreeExpression` (must already be serialized — no `ui_id`).
 * @returns A base64url-encoded string without `=` padding.
 */
export function encodeExpressionToUrl(tree: ExpressionTreeExpression): string {
  return toBase64Url(stableStringify(tree));
}

/**
 * Decodes a base64url `expr` query parameter value back into an
 * `ExpressionTreeExpression`, or returns `null` when the encoded value is
 * missing, malformed, not valid JSON, or fails schema validation.
 *
 * @param encoded - The raw value of the `expr` query parameter.
 * @returns A validated `ExpressionTreeExpression`, or `null` on any failure.
 */
export function decodeExpressionFromUrl(encoded: string | null | undefined): ExpressionTreeExpression | null {
  if (!encoded) {
    return null;
  }

  try {
    const json = fromBase64Url(encoded);
    const parsed: unknown = JSON.parse(json);

    if (!isValidExpressionTree(parsed)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}
