import { IDBConnection } from '../../database/db';
import { FeatureProperty, FeatureTypeWithProperties } from '../../models/feature-type';
import { IFlattenedBlock } from '../../models/submission-feature';
import { IngestionRepository } from '../../repositories/ingestion/ingestion-repository';
import { parseCodeReference } from '../../utils/code-reference';
import { GeoJSONFeatureCollectionZodSchema } from '../../zod-schema/geoJsonZodSchema';
import { DBService } from '../db-service';
import { IValidationError, IValidationResult, ValidationErrorType } from './feature-validation-service.interface';
import type { TarCodesets } from './submission-ingestion-codes-service.interface';

/**
 * Service for validating flat submission features against the database schema.
 *
 * Handles structure validation, type validation, property validation, and reference validation.
 *
 * Validation Rules:
 * - Calculated property (calculated_value=true) — No validation, system sets value during ingestion
 * - Required property missing (required_value=true, calculated_value=false) — MISSING_REQUIRED_PROPERTY error
 * - Known optional property missing — No error
 * - Known property with wrong type — INVALID_PROPERTY_TYPE error
 * - Unknown property — Silently ignored, persisted to JSONB
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
   * @param {TarCodesets} [codesets] - Optional in-memory codeset payload keyed by contributor codeset key
   * @return {Promise<IValidationResult>} Validation result with all collected errors
   * @memberof FeatureValidationService
   */
  async validateFlatSubmissionFeatures(
    features: IFlattenedBlock[],
    codesets?: TarCodesets
  ): Promise<IValidationResult> {
    const errors: IValidationError[] = [];

    // Build once per submission for O(1) code slug existence checks during property validation.
    const codeSlugs = codesets ? this.buildCodeSlugs(codesets) : new Set<string>();

    // First pass: collect all feature IDs and check for duplicates
    const allIds = new Set<string>();
    const duplicateIds = new Set<string>();

    for (const feature of features) {
      if (!feature.id) {
        continue;
      }

      if (allIds.has(feature.id)) {
        duplicateIds.add(feature.id);
      }

      allIds.add(feature.id);
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
      errors.push(...(await this.validateSingleFeature(feature, codeSlugs)));
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
   * Validate a single feature through structure, type, and property passes.
   *
   * @private
   * @param {IFlattenedBlock} feature
   * @param {Set<string>} codeSlugs
   * @return {Promise<IValidationError[]>}
   * @memberof FeatureValidationService
   */
  private async validateSingleFeature(feature: IFlattenedBlock, codeSlugs: Set<string>): Promise<IValidationError[]> {
    const errors: IValidationError[] = [];

    // Structure validation (required fields per ticket spec item 1)
    const structureErrors = this.validateFeatureStructure(feature);
    errors.push(...structureErrors);

    // Skip further validation if structure is invalid
    if (structureErrors.length > 0) {
      return errors;
    }

    // Feature type validation (exists in DB)
    const typeErrors = await this.validateFeatureType(feature);
    errors.push(...typeErrors);

    // If type is valid, validate properties
    if (typeErrors.length > 0) {
      return errors;
    }

    const featureTypeWithProperties = await this.findFeatureTypeWithPropertiesCached(feature.type);
    if (!featureTypeWithProperties) {
      return errors;
    }

    const propertyErrors = this.validateFeaturePropertyFlat(feature, featureTypeWithProperties.properties, codeSlugs);
    errors.push(...propertyErrors);

    return errors;
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
    const featureId = feature.id;

    // Check required fields per ticket spec: ID, feature_type, properties, references
    if (featureId === undefined || featureId === null) {
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
   * @param {Set<string>} codeSlugs - In-memory set of valid code slug values
   * @return {IValidationError[]} Array of validation errors (empty if valid)
   * @memberof FeatureValidationService
   */
  validateFeaturePropertyFlat(
    feature: IFlattenedBlock,
    allowedProperties: FeatureProperty[],
    codeSlugs: Set<string>
  ): IValidationError[] {
    const errors: IValidationError[] = [];

    // Check required properties and types
    for (const property of allowedProperties) {
      // Calculated properties are system-owned — skip all validation
      if (property.calculated_value) {
        continue;
      }

      const value = feature.properties[property.name];

      // Check if required property is missing
      if (property.required_value && (value === undefined || value === null)) {
        errors.push({
          type: ValidationErrorType.MISSING_REQUIRED_PROPERTY,
          featureId: feature.id,
          featureType: feature.type,
          field: property.name,
          message: `Missing required property '${property.name}' for feature type '${feature.type}'`
        });
        continue;
      }

      // Skip type check if value is null/undefined (optional property)
      if (value === undefined || value === null) {
        continue;
      }

      // Check property type
      const typeError = this.validatePropertyType(feature, property, value, codeSlugs);
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
   * @param {FeatureProperty} property - Property definition
   * @param {unknown} value - Actual value to validate
   * @param {Set<string>} codeSlugs - In-memory set of valid code slug values
   * @return {IValidationError | null} Validation error if type mismatch, null otherwise
   * @memberof FeatureValidationService
   */
  validatePropertyType(
    feature: IFlattenedBlock,
    property: FeatureProperty,
    value: unknown,
    codeSlugs: Set<string>
  ): IValidationError | null {
    const propertyValuesResult = this.getPropertyValues(feature, property, value);
    if (propertyValuesResult.errors.length) {
      return propertyValuesResult.errors[0];
    }

    const propertyValidators: Record<string, (propertyValue: unknown) => IValidationError | null> = {
      code: (propertyValue) => this.validateCodeProperty(feature, property, propertyValue, codeSlugs),
      string: (propertyValue) => this.validateStringProperty(feature, property, propertyValue),
      number: (propertyValue) => this.validateNumberProperty(feature, property, propertyValue),
      boolean: (propertyValue) => this.validateBooleanProperty(feature, property, propertyValue),
      object: (propertyValue) => this.validateObjectProperty(feature, property, propertyValue),
      geometry: (propertyValue) => this.validateGeometryProperty(feature, property, propertyValue),
      timestamp: (propertyValue) => this.validateTimestampProperty(feature, property, propertyValue),
      taxon: (propertyValue) => this.validateTaxonProperty(feature, property, propertyValue)
    };

    const validator = propertyValidators[property.type_name];
    if (!validator) {
      return null;
    }

    for (const propertyValue of propertyValuesResult.values) {
      const error = validator(propertyValue);
      if (error) {
        return error;
      }
    }

    return null;
  }

  /**
   * Create a standardized invalid property type error.
   *
   * @private
   * @param {IFlattenedBlock} feature
   * @param {FeatureProperty} property
   * @param {string} expectedType
   * @param {unknown} value
   * @return {IValidationError}
   * @memberof FeatureValidationService
   */
  private createInvalidPropertyTypeError(
    feature: IFlattenedBlock,
    property: FeatureProperty,
    expectedType: string,
    value: unknown
  ): IValidationError {
    return {
      type: ValidationErrorType.INVALID_PROPERTY_TYPE,
      featureId: feature.id,
      featureType: feature.type,
      field: property.name,
      message: `Property '${property.name}' expected type '${expectedType}', got '${typeof value}'`
    };
  }

  /**
   * Normalize a property value into a list of values according to allow_multiple.
   *
   * @private
   * @param {IFlattenedBlock} feature
   * @param {FeatureProperty} property
   * @param {unknown} value
   * @return {{ values: unknown[]; errors: IValidationError[] }}
   * @memberof FeatureValidationService
   */
  private getPropertyValues(
    feature: IFlattenedBlock,
    property: FeatureProperty,
    value: unknown
  ): { values: unknown[]; errors: IValidationError[] } {
    if (property.allow_multiple) {
      if (!Array.isArray(value)) {
        return {
          values: [],
          errors: [
            this.createInvalidPropertyTypeError(feature, property, `array of ${property.type_name} values`, value)
          ]
        };
      }

      return { values: value, errors: [] };
    }

    if (Array.isArray(value)) {
      return {
        values: [],
        errors: [this.createInvalidPropertyTypeError(feature, property, property.type_name, value)]
      };
    }

    return { values: [value], errors: [] };
  }

  /**
   * Validate string property values.
   *
   * @private
   * @param {IFlattenedBlock} feature
   * @param {FeatureProperty} property
   * @param {unknown} value
   * @return {IValidationError | null}
   * @memberof FeatureValidationService
   */
  private validateStringProperty(
    feature: IFlattenedBlock,
    property: FeatureProperty,
    value: unknown
  ): IValidationError | null {
    return typeof value === 'string' ? null : this.createInvalidPropertyTypeError(feature, property, 'string', value);
  }

  /**
   * Validate number property values.
   *
   * @private
   * @param {IFlattenedBlock} feature
   * @param {FeatureProperty} property
   * @param {unknown} value
   * @return {IValidationError | null}
   * @memberof FeatureValidationService
   */
  private validateNumberProperty(
    feature: IFlattenedBlock,
    property: FeatureProperty,
    value: unknown
  ): IValidationError | null {
    return typeof value === 'number' ? null : this.createInvalidPropertyTypeError(feature, property, 'number', value);
  }

  /**
   * Validate boolean property values.
   *
   * @private
   * @param {IFlattenedBlock} feature
   * @param {FeatureProperty} property
   * @param {unknown} value
   * @return {IValidationError | null}
   * @memberof FeatureValidationService
   */
  private validateBooleanProperty(
    feature: IFlattenedBlock,
    property: FeatureProperty,
    value: unknown
  ): IValidationError | null {
    return typeof value === 'boolean' ? null : this.createInvalidPropertyTypeError(feature, property, 'boolean', value);
  }

  /**
   * Validate object property values.
   *
   * @private
   * @param {IFlattenedBlock} feature
   * @param {FeatureProperty} property
   * @param {unknown} value
   * @return {IValidationError | null}
   * @memberof FeatureValidationService
   */
  private validateObjectProperty(
    feature: IFlattenedBlock,
    property: FeatureProperty,
    value: unknown
  ): IValidationError | null {
    return typeof value === 'object' && !Array.isArray(value)
      ? null
      : this.createInvalidPropertyTypeError(feature, property, 'object', value);
  }

  /**
   * Validate geometry property values.
   *
   * @private
   * @param {IFlattenedBlock} feature
   * @param {FeatureProperty} property
   * @param {unknown} value
   * @return {IValidationError | null}
   * @memberof FeatureValidationService
   */
  private validateGeometryProperty(
    feature: IFlattenedBlock,
    property: FeatureProperty,
    value: unknown
  ): IValidationError | null {
    return GeoJSONFeatureCollectionZodSchema.safeParse(value).success
      ? null
      : this.createInvalidPropertyTypeError(feature, property, 'geometry (GeoJSON FeatureCollection)', value);
  }

  /**
   * Validate timestamp property values.
   *
   * @private
   * @param {IFlattenedBlock} feature
   * @param {FeatureProperty} property
   * @param {unknown} value
   * @return {IValidationError | null}
   * @memberof FeatureValidationService
   */
  private validateTimestampProperty(
    feature: IFlattenedBlock,
    property: FeatureProperty,
    value: unknown
  ): IValidationError | null {
    return typeof value === 'string'
      ? null
      : this.createInvalidPropertyTypeError(feature, property, 'timestamp', value);
  }

  /**
   * Validate taxon property values.
   *
   * @private
   * @param {IFlattenedBlock} feature
   * @param {FeatureProperty} property
   * @param {unknown} value
   * @return {IValidationError | null}
   * @memberof FeatureValidationService
   */
  private validateTaxonProperty(
    feature: IFlattenedBlock,
    property: FeatureProperty,
    value: unknown
  ): IValidationError | null {
    return typeof value === 'number' && Number.isInteger(value)
      ? null
      : this.createInvalidPropertyTypeError(feature, property, 'taxon TSN (integer)', value);
  }

  /**
   * Validate code property slugs against in-memory codeset definitions.
   *
   * Accepted slug format: `code::<contributor-codeset-key>::<contributor-codeset-code-key>`.
   * Resolution path: O(1) membership checks against a prebuilt code slug set.
   *
   * @private
   * @param {IFlattenedBlock} feature
   * @param {FeatureProperty} property
   * @param {unknown} value
   * @param {Set<string>} codeSlugs
   * @return {IValidationError | null}
   * @memberof FeatureValidationService
   */
  private validateCodeProperty(
    feature: IFlattenedBlock,
    property: FeatureProperty,
    value: unknown,
    codeSlugs: Set<string>
  ): IValidationError | null {
    if (typeof value !== 'string') {
      return this.createInvalidPropertyTypeError(feature, property, 'code slug string', value);
    }

    const parsed = parseCodeReference(value);

    if (!parsed) {
      return {
        type: ValidationErrorType.INVALID_CODE_SLUG,
        featureId: feature.id,
        featureType: feature.type,
        field: property.name,
        value,
        message:
          "Invalid code slug format. Expected 'code::<contributor-codeset-key>::<contributor-codeset-code-key>' and ensure a codeset file is provided."
      };
    }

    if (!codeSlugs.has(parsed.slug)) {
      return {
        type: ValidationErrorType.INVALID_CODE_REFERENCE,
        featureId: feature.id,
        featureType: feature.type,
        field: property.name,
        value,
        message: `Code slug '${value}' not found in codeset. Ensure codeset[${parsed.contributorCodesetKey}].codes[${parsed.contributorCodesetCodeKey}] exists.`
      };
    }

    return null;
  }

  /**
   * Build an in-memory set of valid `code::<codeset>::<code>` slugs.
   *
   * This is intentionally precomputed once and then reused for O(1) membership checks
   * while validating code-typed properties across all features.
   *
   * @private
   * @param {TarCodesets} codesets
   * @return {Set<string>}
   * @memberof FeatureValidationService
   */
  private buildCodeSlugs(codesets: TarCodesets): Set<string> {
    const codeSlugs = new Set<string>();

    for (const [contributorCodesetKey, contributorCodesetValue] of Object.entries(codesets)) {
      const codes = contributorCodesetValue.codes;
      if (!codes) {
        continue;
      }

      for (const contributorCodesetCodeKey of Object.keys(codes)) {
        codeSlugs.add(`code::${contributorCodesetKey}::${contributorCodesetCodeKey}`);
      }
    }

    return codeSlugs;
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
