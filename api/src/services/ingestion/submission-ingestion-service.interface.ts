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
  /** Code property slug format is invalid */
  INVALID_CODE_SLUG = 'Invalid Code Slug',
  /** Code property slug does not resolve in provided codeset definitions */
  INVALID_CODE_REFERENCE = 'Invalid Code Reference',
  /** Code property resolves ambiguously and cannot map to a single code */
  AMBIGUOUS_CODE_REFERENCE = 'Ambiguous Code Reference',

  // Reference errors
  /** Multiple features have the same id */
  DUPLICATE_ID = 'Duplicate ID',
  /** Parent or content UUID does not resolve to a feature in the submission */
  UNRESOLVED_REFERENCE = 'Unresolved Reference',
  /** Feature references itself in parent or content */
  SELF_REFERENCE = 'Self Reference',

  // Media errors
  /** A file/report block references a media file not found in the archive */
  MISSING_MEDIA_FILE = 'Missing Media File',
  /** Media reference resolves ambiguously and cannot map to a single archive file */
  AMBIGUOUS_MEDIA_REFERENCE = 'Ambiguous Media Reference'
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
 * Non-fatal validation records captured during ingestion.
 * These are persisted as metadata to explain dropped/ignored rows.
 */
export interface IValidationRecord {
  level: 'warning';
  code: 'unknown_feature_type_ignored' | 'feature_not_inserted';
  message: string;
  details: Record<string, unknown>;
}

/**
 * Counts captured during archive ingestion and persisted to validation metadata.
 */
export interface IValidationMetadata extends Record<string, unknown> {
  errorCount: number;
  recordCount: number;
  featureCount?: number;
  uploadedCount?: number;
  codesetFileCount?: number;
  featureBatchCount?: number;
  codesetBatchCount?: number;
  mediaBatchCount?: number;
  featureRowsPersisted?: number;
  mediaFilesPersisted?: number;
  mediaBytesPersisted?: number;
}

/**
 * Result of validating submission features.
 * Contains validation status and all collected errors.
 */
export interface IValidationResult {
  valid: boolean;
  errors: IValidationError[];
  records?: IValidationRecord[];
  metadata?: IValidationMetadata;
}
