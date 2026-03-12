/**
 * Validation error types for submission feature validation.
 * Used to categorize validation errors for structured error reporting.
 */
export enum ValidationErrorType {
  // Structure errors
  /** Feature is missing a required field (id, type, properties, content, or parent) */
  MISSING_FIELD = 'Missing Field',

  // Type errors
  /** Feature type does not exist in the feature_type table */
  INVALID_FEATURE_TYPE = 'Invalid Feature Type',

  // Property errors
  /** A required property for this feature type is missing */
  MISSING_REQUIRED_PROPERTY = 'Missing Required Property',
  /** Property value has wrong type (e.g., string instead of number) */
  INVALID_PROPERTY_TYPE = 'Invalid Property Type',
  /** Code property token format is invalid */
  INVALID_CODE_TOKEN = 'Invalid Code Token',
  /** Code property token does not resolve in provided codeset definitions */
  INVALID_CODE_REFERENCE = 'Invalid Code Reference',

  // Reference errors
  /** Multiple features have the same id */
  DUPLICATE_ID = 'Duplicate ID',
  /** Parent or content UUID does not resolve to a feature in the submission */
  UNRESOLVED_REFERENCE = 'Unresolved Reference',
  /** Feature references itself in parent or content */
  SELF_REFERENCE = 'Self Reference',

  // Media errors
  /** A file/report block references a media file not found in the archive */
  MISSING_MEDIA_FILE = 'Missing Media File'
}

/**
 * Structured validation error for submission feature validation.
 * Contains details about what failed and where.
 */
export interface IValidationError {
  type: ValidationErrorType;
  featureId?: string;
  featureType?: string;
  field?: string;
  value?: string;
  message: string;
}

/**
 * Result of validating submission features.
 * Contains validation status and all collected errors.
 */
export interface IValidationResult {
  valid: boolean;
  errors: IValidationError[];
}
