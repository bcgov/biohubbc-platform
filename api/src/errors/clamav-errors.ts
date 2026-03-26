export class ClamAvScanValidationError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'ClamAvScanValidationError';
  }
}
