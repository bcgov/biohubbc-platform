import { describe, expect, it } from 'vitest';
import { isAbortError } from './request';

describe('isAbortError', () => {
  it.each(['AbortError', 'CanceledError'])('recognizes an error named %s', (name) => {
    const error = new Error();
    error.name = name;

    expect(isAbortError(error)).toBe(true);
  });

  it('recognizes the HTTP client cancellation message', () => {
    expect(isAbortError(new Error('canceled'))).toBe(true);
  });

  it('rejects unrelated values', () => {
    expect(isAbortError(new Error('failed'))).toBe(false);
    expect(isAbortError('canceled')).toBe(false);
  });
});
