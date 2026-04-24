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
});
