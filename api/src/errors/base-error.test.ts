import { expect } from 'chai';
import { describe } from 'mocha';
import { ApiError, ApiNotFoundError } from './api-error';
import { BaseError } from './base-error';

class TestBaseError extends BaseError {
  constructor(message: string, errors?: (string | object)[], stack?: string) {
    super('Test Error', message, errors, stack);
  }
}

describe('BaseError', () => {
  it('preserves prototype chain for subclasses', () => {
    const err = new TestBaseError('boom');

    expect(err).to.be.instanceOf(Error);
    expect(err).to.be.instanceOf(BaseError);
    expect(err).to.be.instanceOf(TestBaseError);
  });

  it('preserves prototype chain for ApiError subclasses', () => {
    const err = new ApiNotFoundError('Cart not found');

    expect(err).to.be.instanceOf(Error);
    expect(err).to.be.instanceOf(ApiError);
    expect(err).to.be.instanceOf(ApiNotFoundError);
  });

  it('normalizes nested Error values in errors array', () => {
    const nested = new Error('nested failure');
    const err = new TestBaseError('boom', [nested, 'extra']);

    expect(err.errors).to.deep.equal([{ name: 'Error', message: 'nested failure' }, 'extra']);
  });

  it('uses the provided stack when supplied', () => {
    const customStack = 'custom-stack-line';
    const err = new TestBaseError('boom', [], customStack);

    expect(err.stack).to.equal(customStack);
  });

  describe('Symbol.hasInstance override (ESM cross-module identity)', () => {
    it('matches an instance branded with the same global symbol from a foreign class', () => {
      // Simulates ESM module duplication: a class object distinct from the
      // real ApiNotFoundError but whose instances carry the same registered
      // symbol brand (because both classes used `Symbol.for(...)` with the
      // same string key — that's the entire point of the registry).
      class ForeignApiNotFoundError extends Error {
        constructor(message: string) {
          super(message);
          Object.defineProperty(this, Symbol.for('@biohub/error/ApiNotFoundError'), { value: true });
          Object.defineProperty(this, Symbol.for('@biohub/error/ApiError'), { value: true });
          Object.defineProperty(this, Symbol.for('@biohub/error/BaseError'), { value: true });
        }
      }
      const fake: unknown = new ForeignApiNotFoundError('not found');

      expect(fake instanceof ApiNotFoundError).to.be.true;
      expect(fake instanceof ApiError).to.be.true;
      expect(fake instanceof BaseError).to.be.true;
    });

    it('returns false for an instance carrying only some of the expected brands', () => {
      // A foreign class branded as ApiError but not ApiNotFoundError must not
      // pass `instanceof ApiNotFoundError`.
      class ForeignApiError extends Error {
        constructor(message: string) {
          super(message);
          Object.defineProperty(this, Symbol.for('@biohub/error/ApiError'), { value: true });
        }
      }
      const fake: unknown = new ForeignApiError('boom');

      expect(fake instanceof ApiError).to.be.true;
      expect(fake instanceof ApiNotFoundError).to.be.false;
    });

    it('returns false for unrelated errors', () => {
      const plain = new Error('plain');

      expect(plain instanceof BaseError).to.be.false;
      expect(plain instanceof ApiError).to.be.false;
      expect(plain instanceof ApiNotFoundError).to.be.false;
    });

    it('returns false for non-object values', () => {
      expect(null instanceof BaseError).to.be.false;
      expect(undefined instanceof BaseError).to.be.false;
      expect('string' instanceof BaseError).to.be.false;
      expect(42 instanceof BaseError).to.be.false;
    });
  });
});
