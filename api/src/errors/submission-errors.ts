import { BaseError } from './base-error';

export class IngestionValidationError extends BaseError {
  static readonly brand: symbol = Symbol.for('@biohub/error/IngestionValidationError');

  constructor(message: string) {
    super('IngestionValidationError', message);
  }
}
