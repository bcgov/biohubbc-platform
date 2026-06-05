import { BaseError } from './base-error';

export class ClamAvScanValidationError extends BaseError {
  static readonly brand: symbol = Symbol.for('@biohub/error/ClamAvScanValidationError');

  constructor(message: string) {
    super('ClamAvScanValidationError', message);
  }
}
