import { JsonValue } from '../zod-schema/json';

const MAX_JSON_SANITIZE_DEPTH = 100;

/**
 * Sanitizes a JSON-compatible value for JSONB persistence.
 *
 * Removes null-byte characters (`\u0000`) from all string values and preserves
 * the original object/array structure. Includes cycle and depth guards so
 * traversal is bounded and safe even with unexpected object graphs.
 *
 * @param {JsonValue} value Value to sanitize before JSONB persistence.
 * @return {JsonValue} Sanitized value safe for JSONB serialization.
 */
export function sanitizeJsonbValue(value: JsonValue): JsonValue {
  /**
   * Tracks objects currently being traversed on the active recursion path.
   *
   * WeakSet is used instead of Set so we do not keep strong references to
   * traversed objects beyond their natural lifetime. This prevents the cycle
   * guard from introducing memory retention side effects.
   */
  const activePath = new WeakSet<object>();
  return _sanitizeJsonbValue(value, activePath, 0);
}

/**
 * Depth-first JSON value sanitizer used by {@link sanitizeJsonbValue}.
 *
 * Behavior:
 * - Removes null-byte characters (`\u0000`) from string values.
 * - Recursively traverses arrays and objects while preserving structure.
 * - Detects cyclical object references with `activePath` to avoid infinite recursion.
 * - Stops traversal after `MAX_JSON_SANITIZE_DEPTH` as a defensive bound.
 *
 * Cycle detection details:
 * - Objects are added to `activePath` before traversing children and always
 *   removed in `finally`, even if traversal throws.
 * - If we encounter an object already in `activePath`, we have a cycle on the
 *   current recursion chain and immediately return the original value.
 *
 * @param {JsonValue} value Current node being sanitized.
 * @param {WeakSet<object>} activePath Objects in the active recursion chain.
 * @param {number} depth Current recursion depth (root starts at 0).
 * @return {JsonValue} Sanitized value for the current node.
 */
function _sanitizeJsonbValue(value: JsonValue, activePath: WeakSet<object>, depth: number): JsonValue {
  if (typeof value === 'string') {
    // PostgreSQL text/JSONB cannot contain null bytes.
    return value.includes('\u0000') ? value.split('\u0000').join('') : value;
  }

  if (Array.isArray(value)) {
    // Defensive bound: stop deep traversal to avoid pathological recursion cost.
    if (depth >= MAX_JSON_SANITIZE_DEPTH) {
      return value;
    }

    return value.map((entry) => _sanitizeJsonbValue(entry, activePath, depth + 1));
  }

  if (value !== null && typeof value === 'object') {
    // Cycle guard: return as-is if this object is already on the active path.
    if (activePath.has(value)) {
      return value;
    }

    // Defensive bound: stop deep traversal to avoid pathological recursion cost.
    if (depth >= MAX_JSON_SANITIZE_DEPTH) {
      return value;
    }

    // Mark current object before descending to child nodes.
    activePath.add(value);
    const recordValue = value as { [key: string]: JsonValue };
    try {
      return Object.fromEntries(
        Object.entries(recordValue).map(([key, entry]) => [key, _sanitizeJsonbValue(entry, activePath, depth + 1)])
      );
    } finally {
      // Ensure path tracking is always cleaned up for sibling branches.
      activePath.delete(value);
    }
  }

  return value;
}
