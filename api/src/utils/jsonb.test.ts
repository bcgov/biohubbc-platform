import { expect } from 'chai';
import { JsonValue } from '../zod-schema/json';
import { sanitizeJsonbValue } from './jsonb';

describe('sanitizeJsonbValue', () => {
  it('removes null bytes from string values', () => {
    const result = sanitizeJsonbValue('abc\u0000def');

    expect(result).to.equal('abcdef');
  });

  it('sanitizes nested objects and arrays while preserving structure', () => {
    const input = {
      message: 'he\u0000llo',
      nested: {
        list: ['a\u0000', 1, false, null, { value: 'b\u0000c' }]
      }
    };

    const result = sanitizeJsonbValue(input);

    expect(result).to.deep.equal({
      message: 'hello',
      nested: {
        list: ['a', 1, false, null, { value: 'bc' }]
      }
    });
  });

  it('returns primitives unchanged when sanitization is not needed', () => {
    expect(sanitizeJsonbValue(123)).to.equal(123);
    expect(sanitizeJsonbValue(true)).to.equal(true);
    expect(sanitizeJsonbValue(false)).to.equal(false);
    expect(sanitizeJsonbValue(null)).to.equal(null);
  });

  it('handles cyclical object graphs without infinite recursion', () => {
    const cyclical: Record<string, unknown> = {
      root: 'ro\u0000ot'
    };
    cyclical.self = cyclical;

    const result = sanitizeJsonbValue(cyclical as unknown as JsonValue) as Record<string, unknown>;

    expect(result).to.not.equal(cyclical);
    expect(result.root).to.equal('root');
    expect(result.self).to.equal(cyclical);
  });

  it('stops traversal at max depth and leaves deeper values unchanged', () => {
    let deep: unknown = 'de\u0000ep';
    for (let i = 0; i < 101; i++) {
      deep = [deep];
    }

    const result = sanitizeJsonbValue(deep as JsonValue) as unknown[];

    let current: unknown = result;
    for (let i = 0; i < 101; i++) {
      current = (current as unknown[])[0];
    }

    expect(current).to.equal('de\u0000ep');
  });
});
