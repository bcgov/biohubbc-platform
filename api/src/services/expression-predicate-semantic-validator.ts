import type { PredicatePropertyTypeName } from '../constants/expression';
import { OperatorsByPropertyType, SupportedExpressionPropertyTypes } from '../constants/expression';
import { IDBConnection } from '../database/db';
import { ApiValidationError } from '../errors/api-error';
import type {
  InternalTypedPredicate,
  PredicateOperator,
  TimestampInternalPredicate
} from '../models/expression-predicate';
import { ExpressionTree, ExpressionTreeClause, ExpressionTreePredicate } from '../models/expression-tree';
import {
  NormalizedExpressionTreeClause,
  NormalizedExpressionTreeExpression,
  NormalizedExpressionTreePredicate
} from '../models/expression-tree-internal';
import { FEATURE_PROPERTY_TYPE } from '../models/feature-property';
import { FeatureTypePropertyRepository } from '../repositories/feature-type-property-repository';
import { parseTimestamp } from '../utils/timestamp';
import { GeoJSONGeometryZodSchema } from '../zod-schema/geoJsonZodSchema';
import { DBService } from './db-service';

/**
 * Validates and normalizes expression predicates against database property metadata.
 *
 * Zod handles public expression tree structure before this service is called. This service owns metadata-dependent
 * checks: property type resolution, operator compatibility, value shape, and conversion to repository-ready internal
 * predicate payloads.
 *
 * @export
 * @class ExpressionPredicateSemanticValidator
 * @extends {DBService}
 */
export class ExpressionPredicateSemanticValidator extends DBService {
  featureTypePropertyRepository: FeatureTypePropertyRepository;

  /**
   * Build the semantic validator.
   *
   * @param {IDBConnection} connection - Active database connection.
   * @memberof ExpressionPredicateSemanticValidator
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.featureTypePropertyRepository = new FeatureTypePropertyRepository(connection);
  }

  /**
   * Validate every predicate in an expression tree and return a normalized tree.
   *
   * @param {ExpressionTree} tree - Structurally parsed expression tree.
   * @return {Promise<NormalizedExpressionTreeExpression>} Expression tree with resolved predicate metadata.
   * @memberof ExpressionPredicateSemanticValidator
   */
  async validateExpressionTree(tree: ExpressionTree): Promise<NormalizedExpressionTreeExpression> {
    // Preserve the public expression structure; enrich only predicate leaves.
    return {
      type: 'expression',
      operator: tree.operator,
      clauses: await Promise.all(tree.clauses.map((clause) => this.validateClause(clause)))
    };
  }

  /**
   * Validate one expression clause.
   *
   * Recurses through nested expressions and delegates predicate leaves to metadata-backed validation.
   *
   * @param {ExpressionTreeClause} clause - Expression or predicate clause.
   * @return {Promise<NormalizedExpressionTreeClause>} Normalized clause.
   * @private
   * @memberof ExpressionPredicateSemanticValidator
   */
  private async validateClause(clause: ExpressionTreeClause): Promise<NormalizedExpressionTreeClause> {
    if (clause.type === 'expression') {
      // Rebuild expression nodes so child clauses carry normalized metadata.
      return {
        type: 'expression',
        operator: clause.operator,
        clauses: await Promise.all(clause.clauses.map((child) => this.validateClause(child)))
      };
    }

    return this.validatePredicate(clause);
  }

  /**
   * Validate and normalize one predicate leaf.
   *
   * Resolves the selected property, verifies operator compatibility, validates the value, and attaches the internal
   * typed predicate used by hashing, persistence, and search SQL.
   *
   * @param {ExpressionTreePredicate} predicate - Public predicate leaf.
   * @return {Promise<NormalizedExpressionTreePredicate>} Predicate with resolved property metadata and internal value.
   * @private
   * @memberof ExpressionPredicateSemanticValidator
   */
  private async validatePredicate(predicate: ExpressionTreePredicate): Promise<NormalizedExpressionTreePredicate> {
    // Metadata resolution also checks feature_type_property_id ownership when one is supplied.
    const metadata = await this.featureTypePropertyRepository.getExpressionPredicatePropertyMetadata(
      predicate.feature_property_id,
      predicate.feature_type_property_id
    );

    // Only property types in the registry are predicate-capable in this branch.
    if (!SupportedExpressionPropertyTypes.has(metadata.feature_property_type_name)) {
      throw new ApiValidationError('Unsupported predicate property type', [
        'ExpressionPredicateSemanticValidator->validatePredicate',
        { featurePropertyTypeName: metadata.feature_property_type_name }
      ]);
    }

    const propertyType: PredicatePropertyTypeName = metadata.feature_property_type_name;
    const allowedOperators: readonly PredicateOperator[] = OperatorsByPropertyType[propertyType];

    // Operator compatibility is semantic because it depends on the resolved property type.
    if (!allowedOperators.includes(predicate.operator)) {
      throw new ApiValidationError('Predicate operator is not valid for property type', [
        'ExpressionPredicateSemanticValidator->validatePredicate',
        { operator: predicate.operator, propertyType }
      ]);
    }

    // Convert the public scalar value into the internal typed payload expected downstream.
    const internal_predicate = this.buildInternalPredicate(predicate, propertyType);

    return {
      ...predicate,
      feature_type_property_id: predicate.feature_type_property_id,
      feature_property_type_id: metadata.feature_property_type_id,
      feature_property_type_name: propertyType,
      internal_predicate
    };
  }

  /**
   * Convert a public predicate value to an internal typed predicate payload.
   *
   * `Exists` is validated before type-specific value checks, then routed through the same property type switch.
   *
   * @param {ExpressionTreePredicate} predicate - Public predicate leaf.
   * @param {PredicatePropertyTypeName} propertyType - Resolved property type name.
   * @return {InternalTypedPredicate} Repository-ready predicate payload.
   * @private
   * @memberof ExpressionPredicateSemanticValidator
   */
  private buildInternalPredicate(
    predicate: ExpressionTreePredicate,
    propertyType: PredicatePropertyTypeName
  ): InternalTypedPredicate {
    const isExists = predicate.operator === 'Exists';

    // Exists means "has a value row"; typed value columns remain null.
    if (isExists) {
      if (predicate.value !== undefined) {
        throw new ApiValidationError('Exists predicates must not include a value', [
          'ExpressionPredicateSemanticValidator->buildInternalPredicate',
          { predicate }
        ]);
      }

      switch (propertyType) {
        case FEATURE_PROPERTY_TYPE.STRING:
          return { type: 'string', operator: predicate.operator };
        case FEATURE_PROPERTY_TYPE.NUMBER:
          return { type: 'number', operator: predicate.operator };
        case FEATURE_PROPERTY_TYPE.BOOLEAN:
          return { type: 'boolean', operator: predicate.operator };
        case FEATURE_PROPERTY_TYPE.DATETIME:
          return { type: 'timestamp', operator: predicate.operator };
        case FEATURE_PROPERTY_TYPE.TAXON:
          return { type: 'taxon', operator: predicate.operator };
        case FEATURE_PROPERTY_TYPE.SPATIAL:
          return { type: 'geometry', operator: predicate.operator };
        case FEATURE_PROPERTY_TYPE.CODE:
          return { type: 'code', operator: predicate.operator };
      }
    }

    // Route non-Exists values by resolved property domain, not client-supplied type.
    switch (propertyType) {
      case FEATURE_PROPERTY_TYPE.STRING:
        return { type: 'string', operator: predicate.operator, value: this.requireStringValue(predicate) };
      case FEATURE_PROPERTY_TYPE.NUMBER:
        return { type: 'number', operator: predicate.operator, value: this.requireNumberValue(predicate) };
      case FEATURE_PROPERTY_TYPE.BOOLEAN:
        return { type: 'boolean', operator: predicate.operator, value: this.requireBooleanValue(predicate) };
      case FEATURE_PROPERTY_TYPE.DATETIME:
        return this.buildTimestampPredicate(predicate);
      case FEATURE_PROPERTY_TYPE.TAXON:
        return { type: 'taxon', operator: predicate.operator, value: this.requirePositiveIntegerValue(predicate) };
      case FEATURE_PROPERTY_TYPE.SPATIAL:
        return { type: 'geometry', operator: predicate.operator, value: this.requireGeometryValue(predicate) };
      case FEATURE_PROPERTY_TYPE.CODE:
        return { type: 'code', operator: predicate.operator, value: this.requirePositiveIntegerValue(predicate) };
    }
  }

  /**
   * Require a string predicate value.
   *
   * Used after operator compatibility has already been checked for the resolved property type.
   *
   * @param {ExpressionTreePredicate} predicate - Public predicate leaf.
   * @return {string} Validated string value.
   * @private
   * @memberof ExpressionPredicateSemanticValidator
   */
  private requireStringValue(predicate: ExpressionTreePredicate): string {
    if (typeof predicate.value !== 'string' || predicate.value.length > 250) {
      throw new ApiValidationError('Predicate value must be a string with max length 250', [
        'ExpressionPredicateSemanticValidator->requireStringValue',
        { predicate }
      ]);
    }

    return predicate.value;
  }

  /**
   * Require a numeric predicate value.
   *
   * @param {ExpressionTreePredicate} predicate - Public predicate leaf.
   * @return {number} Validated number value.
   * @private
   * @memberof ExpressionPredicateSemanticValidator
   */
  private requireNumberValue(predicate: ExpressionTreePredicate): number {
    if (typeof predicate.value !== 'number') {
      throw new ApiValidationError('Predicate value must be a number', [
        'ExpressionPredicateSemanticValidator->requireNumberValue',
        { predicate }
      ]);
    }

    return predicate.value;
  }

  /**
   * Require a boolean predicate value.
   *
   * @param {ExpressionTreePredicate} predicate - Public predicate leaf.
   * @return {boolean} Validated boolean value.
   * @private
   * @memberof ExpressionPredicateSemanticValidator
   */
  private requireBooleanValue(predicate: ExpressionTreePredicate): boolean {
    if (typeof predicate.value !== 'boolean') {
      throw new ApiValidationError('Predicate value must be a boolean', [
        'ExpressionPredicateSemanticValidator->requireBooleanValue',
        { predicate }
      ]);
    }

    return predicate.value;
  }

  /**
   * Require a positive integer predicate value.
   *
   * Used for identifier-backed domains such as taxon and contributor codeset code predicates.
   *
   * @param {ExpressionTreePredicate} predicate - Public predicate leaf.
   * @return {number} Validated positive integer value.
   * @private
   * @memberof ExpressionPredicateSemanticValidator
   */
  private requirePositiveIntegerValue(predicate: ExpressionTreePredicate): number {
    if (typeof predicate.value !== 'number' || !Number.isInteger(predicate.value) || predicate.value <= 0) {
      throw new ApiValidationError('Predicate value must be a positive integer', [
        'ExpressionPredicateSemanticValidator->requirePositiveIntegerValue',
        { predicate }
      ]);
    }

    return predicate.value;
  }

  /**
   * Require a valid GeoJSON geometry predicate value.
   *
   * Spatial values already have a dedicated Zod schema, so complex shape validation is delegated there.
   *
   * @param {ExpressionTreePredicate} predicate - Public predicate leaf.
   * @return {unknown} Validated GeoJSON geometry value.
   * @private
   * @memberof ExpressionPredicateSemanticValidator
   */
  private requireGeometryValue(predicate: ExpressionTreePredicate): unknown {
    // Keep spatial validation aligned with the rest of the API by reusing the shared GeoJSON schema.
    const result = GeoJSONGeometryZodSchema.safeParse(predicate.value);

    if (!result.success) {
      throw new ApiValidationError('Predicate value must be a valid GeoJSON geometry', [
        'ExpressionPredicateSemanticValidator->requireGeometryValue',
        { predicate, issues: result.error.issues }
      ]);
    }

    return result.data;
  }

  /**
   * Build an internal timestamp predicate from a scalar temporal literal.
   *
   * Public datetime predicates use strings; persistence and search use separate `date_value` and `time_value` parts.
   * This parses the scalar, enforces operator-specific temporal kinds, and returns the internal timestamp shape.
   *
   * @param {ExpressionTreePredicate} predicate - Public datetime predicate leaf.
   * @return {TimestampInternalPredicate} Internal timestamp predicate payload.
   * @private
   * @memberof ExpressionPredicateSemanticValidator
   */
  private buildTimestampPredicate(predicate: ExpressionTreePredicate): TimestampInternalPredicate {
    if (typeof predicate.value !== 'string') {
      throw new ApiValidationError('Datetime predicate value must be a scalar string', [
        'ExpressionPredicateSemanticValidator->buildTimestampPredicate',
        { predicate }
      ]);
    }

    // Parse first so format errors are distinct from operator-kind errors.
    const parsed = parseTimestamp(predicate.value);

    if (!parsed) {
      throw new ApiValidationError('Datetime predicate value is not a supported temporal literal', [
        'ExpressionPredicateSemanticValidator->buildTimestampPredicate',
        { value: predicate.value }
      ]);
    }

    // OnDate and OnTime intentionally require strict scalar kinds.
    if (predicate.operator === 'OnDate' && parsed.kind !== 'date') {
      throw new ApiValidationError('OnDate requires a date-only temporal literal', [
        'ExpressionPredicateSemanticValidator->buildTimestampPredicate',
        { value: predicate.value }
      ]);
    }

    if (predicate.operator === 'OnTime' && parsed.kind !== 'time') {
      throw new ApiValidationError('OnTime requires a time-only temporal literal', [
        'ExpressionPredicateSemanticValidator->buildTimestampPredicate',
        { value: predicate.value }
      ]);
    }

    // The registry should prevent this path, but keep the guard close to timestamp normalization.
    if (!['Before', 'After', 'OnDate', 'OnTime'].includes(predicate.operator)) {
      throw new ApiValidationError('Unsupported datetime predicate operator', [
        'ExpressionPredicateSemanticValidator->buildTimestampPredicate',
        { operator: predicate.operator }
      ]);
    }

    return {
      type: 'timestamp',
      operator: predicate.operator,
      value: {
        date_value: parsed.date_value,
        time_value: parsed.time_value
      }
    };
  }
}
