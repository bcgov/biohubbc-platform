import { IDBConnection } from '../../database/db';
import { FeatureProperty, FeatureTypeWithProperties } from '../../models/feature-type';
import { IFlattenedBlock } from '../../models/submission-feature';
import { IngestionRepository } from '../../repositories/ingestion/ingestion-repository';
import { GeoJSONFeatureCollectionZodSchema } from '../../zod-schema/geoJsonZodSchema';
import { DBService } from '../db-service';
import { IValidationError, IValidationResult, ValidationErrorType } from './feature-validation-service.interface';

/**
 * Service for validating flat submission features against the database schema.
 *
 * Handles structure validation, type validation, property validation, and reference validation.
 *
 * Validation Rules:
 * - Calculated prop (calculated_value=true) — No validation, system sets value during ingestion
 * - Required prop missing (required_value=true, calculated_value=false) — MISSING_REQUIRED_PROPERTY error
 * - Known optional prop missing — No error
 * - Known prop with wrong type — INVALID_PROPERTY_TYPE error
 * - Unknown prop — Silently ignored, persisted to JSONB
 *
 * @export
 * @class FeatureValidationService
 * @extends {DBService}
 */
export class FeatureValidationService extends DBService {
  ingestionRepository: IngestionRepository;
  featureTypeCache: Map<string, FeatureTypeWithProperties | null>;

  constructor(connection: IDBConnection) {
    super(connection);

    this.ingestionRepository = new IngestionRepository(connection);
    this.featureTypeCache = new Map<string, FeatureTypeWithProperties | null>();
  }

  /**
   * Validate flat submission features (IFlattenedBlock[] format).
   * Collects ALL validation errors instead of stopping at the first error.
   *
   * @param {IFlattenedBlock[]} features - Array of flat submission features
   * @return {Promise<IValidationResult>} Validation result with all collected errors
   * @memberof FeatureValidationService
   */
  async validateFlatSubmissionFeatures(
    features: IFlattenedBlock[],
    codesetByCategory: Record<string, unknown> = {}
  ): Promise<IValidationResult> {
    const errors: IValidationError[] = [];

    // First pass: collect all feature IDs and check for duplicates
    const allIds = new Set<string>();
    const duplicateIds = new Set<string>();

    for (const feature of features) {
      if (feature.id) {
        if (allIds.has(feature.id)) {
          duplicateIds.add(feature.id);
        }
        allIds.add(feature.id);
      }
    }

    // Report duplicate IDs
    for (const duplicateId of duplicateIds) {
      errors.push({
        type: ValidationErrorType.DUPLICATE_ID,
        featureId: duplicateId,
        value: duplicateId,
        message: `Duplicate feature id: ${duplicateId}`
      });
    }

    // Second pass: validate each feature
    for (const feature of features) {
      // Structure validation (required fields per ticket spec item 1)
      const structureErrors = this.validateFeatureStructure(feature);
      errors.push(...structureErrors);

      // Skip further validation if structure is invalid
      if (structureErrors.length > 0) {
        continue;
      }

      // Feature type validation (exists in DB)
      const typeErrors = await this.validateFeatureType(feature);
      errors.push(...typeErrors);

      // If type is valid, validate properties
      if (typeErrors.length === 0) {
        const featureTypeWithProps = await this.findFeatureTypeWithPropertiesCached(feature.type);
        if (featureTypeWithProps) {
          const propertyErrors = this.validateFeaturePropertyFlat(
            feature,
            featureTypeWithProps.properties,
            codesetByCategory
          );
          errors.push(...propertyErrors);
        }
      }
    }

    // Third pass: validate references (parent/content)
    const referenceErrors = this.validateReferences(features, allIds);
    errors.push(...referenceErrors);

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate the structure of a single feature per ticket spec item 1:
   * "each feature must include an ID, a feature_type, a properties object, and a references collection"
   *
   * @param {IFlattenedBlock} feature - Feature to validate
   * @return {IValidationError[]} Array of validation errors (empty if valid)
   * @memberof FeatureValidationService
   */
  validateFeatureStructure(feature: IFlattenedBlock): IValidationError[] {
    const errors: IValidationError[] = [];
    const featureId = feature.id || 'unknown';

    // Check required fields per ticket spec: ID, feature_type, properties, references
    if (feature.id === undefined || feature.id === null) {
      errors.push({
        type: ValidationErrorType.MISSING_FIELD,
        featureId,
        field: 'id',
        message: 'Feature is missing required field: id'
      });
    }

    if (feature.type === undefined || feature.type === null || feature.type === '') {
      errors.push({
        type: ValidationErrorType.MISSING_FIELD,
        featureId,
        field: 'type',
        message: 'Feature is missing required field: type (feature_type)'
      });
    }

    if (feature.properties === undefined || feature.properties === null) {
      errors.push({
        type: ValidationErrorType.MISSING_FIELD,
        featureId,
        field: 'properties',
        message: 'Feature is missing required field: properties'
      });
    }

    // References collection: content (child references) and parent
    if (feature.content === undefined || feature.content === null) {
      errors.push({
        type: ValidationErrorType.MISSING_FIELD,
        featureId,
        field: 'content',
        message: 'Feature is missing required field: content (references)'
      });
    }

    if (!('parent' in feature)) {
      errors.push({
        type: ValidationErrorType.MISSING_FIELD,
        featureId,
        field: 'parent',
        message: 'Feature is missing required field: parent (references)'
      });
    }

    return errors;
  }

  /**
   * Validate that a feature's type exists in the database.
   *
   * @param {IFlattenedBlock} feature - Feature to validate
   * @return {Promise<IValidationError[]>} Array of validation errors (empty if valid)
   * @memberof FeatureValidationService
   */
  async validateFeatureType(feature: IFlattenedBlock): Promise<IValidationError[]> {
    const errors: IValidationError[] = [];

    const featureTypeWithProps = await this.findFeatureTypeWithPropertiesCached(feature.type);

    if (!featureTypeWithProps) {
      errors.push({
        type: ValidationErrorType.INVALID_FEATURE_TYPE,
        featureId: feature.id,
        featureType: feature.type,
        message: `Invalid feature type: ${feature.type}`
      });
    }

    return errors;
  }

  /**
   * Validate properties of a flat feature against allowed properties.
   * Checks for unknown properties, missing required properties, and type mismatches.
   *
   * @param {IFlattenedBlock} feature - Feature to validate
   * @param {FeatureProperty[]} allowedProperties - Properties defined for this feature type
   * @return {IValidationError[]} Array of validation errors (empty if valid)
   * @memberof FeatureValidationService
   */
  validateFeaturePropertyFlat(
    feature: IFlattenedBlock,
    allowedProperties: FeatureProperty[],
    codesetByCategory: Record<string, unknown> = {}
  ): IValidationError[] {
    const errors: IValidationError[] = [];

    // Check required properties and types
    for (const prop of allowedProperties) {
      // Calculated properties are system-owned — skip all validation
      if (prop.calculated_value) {
        continue;
      }

      const value = feature.properties[prop.name];

      // Check if required property is missing
      if (prop.required_value && (value === undefined || value === null)) {
        errors.push({
          type: ValidationErrorType.MISSING_REQUIRED_PROPERTY,
          featureId: feature.id,
          featureType: feature.type,
          field: prop.name,
          message: `Missing required property '${prop.name}' for feature type '${feature.type}'`
        });
        continue;
      }

      // Skip type check if value is null/undefined (optional property)
      if (value === undefined || value === null) {
        continue;
      }

      // Check property type
      const typeError = this.validatePropertyType(feature, prop, value, codesetByCategory);
      if (typeError) {
        errors.push(typeError);
      }
    }

    return errors;
  }

  /**
   * Validate a single property's type against its expected type.
   *
   * @param {IFlattenedBlock} feature - Feature being validated
   * @param {FeatureProperty} prop - Property definition
   * @param {unknown} value - Actual value to validate
   * @return {IValidationError | null} Validation error if type mismatch, null otherwise
   * @memberof FeatureValidationService
   */
  validatePropertyType(
    feature: IFlattenedBlock,
    prop: FeatureProperty,
    value: unknown,
    codesetByCategory: Record<string, unknown> = {}
  ): IValidationError | null {
    const createTypeError = (expected: string): IValidationError => ({
      type: ValidationErrorType.INVALID_PROPERTY_TYPE,
      featureId: feature.id,
      featureType: feature.type,
      field: prop.name,
      message: `Property '${prop.name}' expected type '${expected}', got '${typeof value}'`
    });

    if (prop.type_name === 'code') {
      return this.validateCodeProperty(feature, prop, value, codesetByCategory);
    }

    // Type validators return error message if invalid, null if valid
    const typeValidators: Record<string, () => string | null> = {
      string: () => (typeof value === 'string' ? null : 'string'),
      number: () => (typeof value === 'number' ? null : 'number'),
      boolean: () => (typeof value === 'boolean' ? null : 'boolean'),
      object: () => (typeof value === 'object' && !Array.isArray(value) ? null : 'object'),
      array: () => (Array.isArray(value) ? null : 'array'),
      spatial: () =>
        GeoJSONFeatureCollectionZodSchema.safeParse(value).success ? null : 'spatial (GeoJSON FeatureCollection)',
      datetime: () => this.validateDatetimeType(value)
    };

    const validator = typeValidators[prop.type_name];
    if (!validator) {
      return null;
    }

    const expectedType = validator();
    if (expectedType) {
      return createTypeError(expectedType);
    }

    return null;
  }

  /**
   * Validate code property token(s) against loaded codeset definitions.
   *
   * Accepted token format: `code::<category>::<category-code>`.
   * Resolution path: `codesetByCategory[category].codes[categoryCode]`.
   *
   * @private
   * @param {IFlattenedBlock} feature
   * @param {FeatureProperty} prop
   * @param {unknown} value
   * @param {Record<string, unknown>} codesetByCategory
   * @return {IValidationError | null}
   * @memberof FeatureValidationService
   */
  private validateCodeProperty(
    feature: IFlattenedBlock,
    prop: FeatureProperty,
    value: unknown,
    codesetByCategory: Record<string, unknown>
  ): IValidationError | null {
    const values = Array.isArray(value) ? value : [value];

    for (const currentValue of values) {
      if (typeof currentValue !== 'string') {
        return {
          type: ValidationErrorType.INVALID_PROPERTY_TYPE,
          featureId: feature.id,
          featureType: feature.type,
          field: prop.name,
          message: `Property '${prop.name}' expected type 'code token string', got '${typeof currentValue}'`
        };
      }

      const split = currentValue.trim().split('::');
      if (split.length !== 3 || split[0] !== 'code' || !split[1] || !split[2]) {
        return {
          type: ValidationErrorType.INVALID_CODE_TOKEN,
          featureId: feature.id,
          featureType: feature.type,
          field: prop.name,
          value: currentValue,
          message:
            "Invalid code token format. Expected 'code::<category>::<category-code>' and ensure a codeset file is provided."
        };
      }

      const categoryKey = split[1];
      const categoryCodeKey = split[2];

      const category = codesetByCategory[categoryKey];
      const codes =
        typeof category === 'object' && category !== null ? (category as Record<string, unknown>)['codes'] : undefined;
      const resolved =
        typeof codes === 'object' && codes !== null ? (codes as Record<string, unknown>)[categoryCodeKey] : undefined;

      if (resolved === undefined) {
        return {
          type: ValidationErrorType.INVALID_CODE_REFERENCE,
          featureId: feature.id,
          featureType: feature.type,
          field: prop.name,
          value: currentValue,
          message: `Code token '${currentValue}' not found in codeset. Ensure codeset[${categoryKey}].codes[${categoryCodeKey}] exists.`
        };
      }
    }

    return null;
  }

  /**
   * Validate datetime type value.
   *
   * @private
   * @param {unknown} value - Value to validate
   * @return {string | null} Expected type string if invalid, null if valid
   * @memberof FeatureValidationService
   */
  private validateDatetimeType(value: unknown): string | null {
    if (typeof value !== 'string') {
      return 'datetime (ISO string)';
    }
    const date = new Date(value);
    return date.toString() === 'Invalid Date' ? 'datetime (ISO string)' : null;
  }

  /**
   * Validate parent and content references point to existing features.
   *
   * @param {IFlattenedBlock[]} features - All features in the submission
   * @param {Set<string>} allIds - Set of all feature IDs
   * @return {IValidationError[]} Array of validation errors (empty if valid)
   * @memberof FeatureValidationService
   */
  validateReferences(features: IFlattenedBlock[], allIds: Set<string>): IValidationError[] {
    const errors: IValidationError[] = [];

    for (const feature of features) {
      const parentErrors = this.validateParentReference(feature, allIds);
      const contentErrors = this.validateContentReferences(feature, allIds);
      errors.push(...parentErrors, ...contentErrors);
    }

    return errors;
  }

  /**
   * Validate a feature's parent reference.
   *
   * @private
   * @param {IFlattenedBlock} feature - Feature being validated
   * @param {Set<string>} allIds - Set of all feature IDs
   * @return {IValidationError[]} Array of validation errors (empty if valid)
   * @memberof FeatureValidationService
   */
  private validateParentReference(feature: IFlattenedBlock, allIds: Set<string>): IValidationError[] {
    if (feature.parent === null) {
      return [];
    }

    if (feature.parent === feature.id) {
      return [
        {
          type: ValidationErrorType.SELF_REFERENCE,
          featureId: feature.id,
          field: 'parent',
          value: feature.parent,
          message: `Feature '${feature.id}' references itself as parent`
        }
      ];
    }

    if (!allIds.has(feature.parent)) {
      return [
        {
          type: ValidationErrorType.UNRESOLVED_REFERENCE,
          featureId: feature.id,
          field: 'parent',
          value: feature.parent,
          message: `Feature '${feature.id}' has unresolved parent reference: ${feature.parent}`
        }
      ];
    }

    return [];
  }

  /**
   * Validate a feature's content references.
   *
   * @private
   * @param {IFlattenedBlock} feature - Feature being validated
   * @param {Set<string>} allIds - Set of all feature IDs
   * @return {IValidationError[]} Array of validation errors (empty if valid)
   * @memberof FeatureValidationService
   */
  private validateContentReferences(feature: IFlattenedBlock, allIds: Set<string>): IValidationError[] {
    if (!feature.content) {
      return [];
    }

    const errors: IValidationError[] = [];

    for (const childId of feature.content) {
      const error = this.validateSingleContentReference(feature, childId, allIds);
      if (error) {
        errors.push(error);
      }
    }

    return errors;
  }

  /**
   * Validate a single content reference.
   *
   * @private
   * @param {IFlattenedBlock} feature - Feature being validated
   * @param {string} childId - Child ID being referenced
   * @param {Set<string>} allIds - Set of all feature IDs
   * @return {IValidationError | null} Validation error if invalid, null if valid
   * @memberof FeatureValidationService
   */
  private validateSingleContentReference(
    feature: IFlattenedBlock,
    childId: string,
    allIds: Set<string>
  ): IValidationError | null {
    if (childId === feature.id) {
      return {
        type: ValidationErrorType.SELF_REFERENCE,
        featureId: feature.id,
        field: 'content',
        value: childId,
        message: `Feature '${feature.id}' references itself in content`
      };
    }

    if (!allIds.has(childId)) {
      return {
        type: ValidationErrorType.UNRESOLVED_REFERENCE,
        featureId: feature.id,
        field: 'content',
        value: childId,
        message: `Feature '${feature.id}' has unresolved content reference: ${childId}`
      };
    }

    return null;
  }

  /**
   * Get feature type with properties, using cache to avoid repeated DB calls.
   *
   * @param {string} typeName - Feature type name to look up
   * @return {Promise<FeatureTypeWithProperties | null>} Feature type with properties, or null if not found
   * @memberof FeatureValidationService
   */
  async findFeatureTypeWithPropertiesCached(typeName: string): Promise<FeatureTypeWithProperties | null> {
    if (this.featureTypeCache.has(typeName)) {
      return this.featureTypeCache.get(typeName) ?? null;
    }

    const result = await this.ingestionRepository.findFeatureTypeWithProperties(typeName);
    this.featureTypeCache.set(typeName, result);
    return result;
  }
}
