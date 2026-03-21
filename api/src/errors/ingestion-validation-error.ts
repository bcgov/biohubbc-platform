export class IngestionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IngestionValidationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
