import { describe, expect, it } from 'vitest';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import {
  decodeExpressionFromUrl,
  encodeExpressionToUrl,
  fromBase64Url,
  isValidExpressionTree,
  stableStringify,
  toBase64Url
} from './expression-url';

// ---------------------------------------------------------------------------
// stableStringify
// ---------------------------------------------------------------------------

describe('stableStringify', () => {
  it('sorts object keys alphabetically', () => {
    const result = stableStringify({ z: 1, a: 2, m: 3 });
    expect(result).toBe('{"a":2,"m":3,"z":1}');
  });

  it('does NOT sort arrays', () => {
    const result = stableStringify([3, 1, 2]);
    expect(result).toBe('[3,1,2]');
  });

  it('preserves clauses array order in nested expressions', () => {
    const tree: ExpressionTreeExpression = {
      type: 'expression',
      operator: 'AND',
      clauses: [
        {
          type: 'predicate',
          feature_property_id: 10,
          feature_type_property_id: null,
          operator: 'Equals',
          value: 'snake'
        },
        {
          type: 'predicate',
          feature_property_id: 20,
          feature_type_property_id: null,
          operator: 'Contains',
          value: 'frog'
        }
      ]
    };
    const result = JSON.parse(stableStringify(tree));
    expect((result.clauses[0] as { feature_property_id: number }).feature_property_id).toBe(10);
    expect((result.clauses[1] as { feature_property_id: number }).feature_property_id).toBe(20);
  });

  it('produces the same output regardless of object key insertion order', () => {
    const a = stableStringify({ operator: 'AND', type: 'expression', clauses: [] });
    const b = stableStringify({ clauses: [], type: 'expression', operator: 'AND' });
    expect(a).toBe(b);
  });

  it('handles null and primitives', () => {
    expect(stableStringify(null)).toBe('null');
    expect(stableStringify(42)).toBe('42');
    expect(stableStringify('hello')).toBe('"hello"');
    expect(stableStringify(true)).toBe('true');
  });

  it('omits undefined properties from objects', () => {
    const result = stableStringify({
      type: 'predicate',
      feature_property_id: 1,
      value: undefined
    });
    expect(result).toBe('{"feature_property_id":1,"type":"predicate"}');
  });

  it('keeps undefined array items as null (matching JSON.stringify semantics)', () => {
    const result = stableStringify([1, undefined, 3]);
    expect(result).toBe('[1,null,3]');
  });
});

// ---------------------------------------------------------------------------
// toBase64Url / fromBase64Url
// ---------------------------------------------------------------------------

describe('toBase64Url', () => {
  it('produces base64url alphabet (no +, /, or = characters)', () => {
    // Run many strings to increase the chance of hitting all alphabet variants.
    const longStr = Array.from({ length: 200 }, (_, i) => String.fromCharCode(65 + (i % 26))).join('');
    const encoded = toBase64Url(longStr);
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it('uses - and _ instead of + and /', () => {
    // btoa of '\xfb\xff' would produce '+/' in standard base64.
    // We encode the bytes 0xfb and 0xff via a known string to trigger + and /.
    const encoded = toBase64Url('{"value":">?"}');
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it('round-trips through fromBase64Url', () => {
    const original = '{"type":"expression","operator":"AND","clauses":[]}';
    expect(fromBase64Url(toBase64Url(original))).toBe(original);
  });

  it('handles multi-byte UTF-8 characters', () => {
    const unicode = '日本語テスト';
    expect(fromBase64Url(toBase64Url(unicode))).toBe(unicode);
  });
});

describe('fromBase64Url', () => {
  it('accepts encoded strings without padding', () => {
    const withoutPadding = toBase64Url('hello');
    expect(withoutPadding).not.toMatch(/=/);
    expect(fromBase64Url(withoutPadding)).toBe('hello');
  });

  it('throws on garbage input', () => {
    expect(() => fromBase64Url('!!!not-base64!!!')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// isValidExpressionTree
// ---------------------------------------------------------------------------

describe('isValidExpressionTree', () => {
  const validSimple: ExpressionTreeExpression = {
    type: 'expression',
    operator: 'AND',
    clauses: [
      {
        type: 'predicate',
        feature_property_id: 1,
        feature_type_property_id: null,
        operator: 'Equals',
        value: 'snake'
      }
    ]
  };

  it('accepts a valid simple expression tree', () => {
    expect(isValidExpressionTree(validSimple)).toBe(true);
  });

  it('accepts a nested expression tree', () => {
    const nested: ExpressionTreeExpression = {
      type: 'expression',
      operator: 'OR',
      clauses: [
        validSimple,
        {
          type: 'expression',
          operator: 'AND',
          clauses: [
            {
              type: 'predicate',
              feature_property_id: 2,
              feature_type_property_id: 5,
              operator: 'Contains'
            }
          ]
        }
      ]
    };
    expect(isValidExpressionTree(nested)).toBe(true);
  });

  it('rejects a node with ui_id (expression node)', () => {
    const withUiId = { ...validSimple, ui_id: 'abc-123' };
    expect(isValidExpressionTree(withUiId)).toBe(false);
  });

  it('rejects a predicate with ui_id', () => {
    const tree: ExpressionTreeExpression = {
      type: 'expression',
      operator: 'AND',
      clauses: [
        {
          type: 'predicate',
          feature_property_id: 1,
          feature_type_property_id: null,
          operator: 'Equals',
          value: 'x',
          // @ts-expect-error intentionally injecting ui_id for test
          ui_id: 'draft-id'
        }
      ]
    };
    expect(isValidExpressionTree(tree)).toBe(false);
  });

  it('rejects unknown logical operator', () => {
    const bad = { ...validSimple, operator: 'XOR' as any };
    expect(isValidExpressionTree(bad)).toBe(false);
  });

  it('rejects unknown predicate operator', () => {
    const bad = {
      type: 'expression' as const,
      operator: 'AND' as const,
      clauses: [
        {
          type: 'predicate' as const,
          feature_property_id: 1,
          feature_type_property_id: null,

          operator: 'IsLike' as any
        }
      ]
    };
    expect(isValidExpressionTree(bad)).toBe(false);
  });

  it('rejects when type is predicate at root', () => {
    const bad = {
      type: 'predicate',
      feature_property_id: 1,
      feature_type_property_id: null,
      operator: 'Equals'
    };
    expect(isValidExpressionTree(bad)).toBe(false);
  });

  it('rejects null, undefined, primitives', () => {
    expect(isValidExpressionTree(null)).toBe(false);
    expect(isValidExpressionTree(undefined)).toBe(false);
    expect(isValidExpressionTree(42)).toBe(false);
    expect(isValidExpressionTree('string')).toBe(false);
  });

  it('rejects missing clauses array', () => {
    const bad = { type: 'expression', operator: 'AND' };
    expect(isValidExpressionTree(bad)).toBe(false);
  });

  it('rejects expression nodes with empty clauses', () => {
    const bad = { type: 'expression', operator: 'AND', clauses: [] };
    expect(isValidExpressionTree(bad)).toBe(false);
  });

  it('rejects non-positive and non-integer predicate ids', () => {
    const badZeroId = {
      type: 'expression',
      operator: 'AND',
      clauses: [
        {
          type: 'predicate',
          feature_property_id: 0,
          feature_type_property_id: null,
          operator: 'Equals'
        }
      ]
    };
    const badFloatId = {
      type: 'expression',
      operator: 'AND',
      clauses: [
        {
          type: 'predicate',
          feature_property_id: 1,
          feature_type_property_id: 1.5,
          operator: 'Equals'
        }
      ]
    };

    expect(isValidExpressionTree(badZeroId)).toBe(false);
    expect(isValidExpressionTree(badFloatId)).toBe(false);
  });

  it('rejects unexpected extra keys on expression and predicate nodes', () => {
    const badExpression = {
      type: 'expression',
      operator: 'AND',
      clauses: [],
      extra: 'unexpected'
    };
    const badPredicate = {
      type: 'expression',
      operator: 'AND',
      clauses: [
        {
          type: 'predicate',
          feature_property_id: 1,
          feature_type_property_id: null,
          operator: 'Equals',
          extra: 'unexpected'
        }
      ]
    };

    expect(isValidExpressionTree(badExpression)).toBe(false);
    expect(isValidExpressionTree(badPredicate)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// encodeExpressionToUrl / decodeExpressionFromUrl — round-trip
// ---------------------------------------------------------------------------

describe('encodeExpressionToUrl and decodeExpressionFromUrl', () => {
  const tree: ExpressionTreeExpression = {
    type: 'expression',
    operator: 'AND',
    clauses: [
      {
        type: 'predicate',
        feature_property_id: 3,
        feature_type_property_id: null,
        operator: 'ILike',
        value: 'snake'
      },
      {
        type: 'expression',
        operator: 'OR',
        clauses: [
          {
            type: 'predicate',
            feature_property_id: 7,
            feature_type_property_id: 2,
            operator: 'GreaterThan',
            value: 10
          }
        ]
      }
    ]
  };

  it('round-trips a complex expression tree', () => {
    const encoded = encodeExpressionToUrl(tree);
    const decoded = decodeExpressionFromUrl(encoded);
    expect(decoded).toEqual(tree);
  });

  it('preserves nested group and clause order after round-trip', () => {
    const encoded = encodeExpressionToUrl(tree);
    const decoded = decodeExpressionFromUrl(encoded) as ExpressionTreeExpression;
    expect(decoded.clauses[0]).toMatchObject({ type: 'predicate', feature_property_id: 3 });
    const group = decoded.clauses[1] as ExpressionTreeExpression;
    expect(group.type).toBe('expression');
    expect((group.clauses[0] as { feature_property_id: number }).feature_property_id).toBe(7);
  });

  it('produces the same encoded value for the same expression regardless of object key order', () => {
    const treeA: ExpressionTreeExpression = {
      type: 'expression',
      operator: 'AND',
      clauses: [{ type: 'predicate', feature_property_id: 1, feature_type_property_id: null, operator: 'Equals' }]
    };
    // Construct same logical tree but with different key insertion order
    const treeB = JSON.parse(
      JSON.stringify({ clauses: treeA.clauses, operator: treeA.operator, type: treeA.type })
    ) as ExpressionTreeExpression;
    expect(encodeExpressionToUrl(treeA)).toBe(encodeExpressionToUrl(treeB));
  });

  it('encoded value contains only base64url alphabet (no +, /, or =)', () => {
    const encoded = encodeExpressionToUrl(tree);
    expect(encoded).not.toMatch(/[+/=]/);
  });
});

// ---------------------------------------------------------------------------
// decodeExpressionFromUrl — error handling
// ---------------------------------------------------------------------------

describe('decodeExpressionFromUrl — error handling', () => {
  it('returns null for null input', () => {
    expect(decodeExpressionFromUrl(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(decodeExpressionFromUrl(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(decodeExpressionFromUrl('')).toBeNull();
  });

  it('returns null for invalid base64url garbage', () => {
    expect(decodeExpressionFromUrl('!!!not-valid!!!')).toBeNull();
  });

  it('returns null for valid base64url that decodes to non-JSON', () => {
    const notJson = toBase64Url('this is not json {{{');
    expect(decodeExpressionFromUrl(notJson)).toBeNull();
  });

  it('returns null for valid JSON that fails schema validation', () => {
    const invalidTree = toBase64Url(JSON.stringify({ type: 'expression', operator: 'XOR', clauses: [] }));
    expect(decodeExpressionFromUrl(invalidTree)).toBeNull();
  });

  it('returns null for a predicate with ui_id in the encoded value', () => {
    const treeWithUiId = toBase64Url(
      JSON.stringify({
        type: 'expression',
        operator: 'AND',
        clauses: [
          {
            type: 'predicate',
            feature_property_id: 1,
            feature_type_property_id: null,
            operator: 'Equals',
            ui_id: 'draft-id'
          }
        ]
      })
    );
    expect(decodeExpressionFromUrl(treeWithUiId)).toBeNull();
  });
});
