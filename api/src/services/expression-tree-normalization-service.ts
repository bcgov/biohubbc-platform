import { OperatorsByPropertyType, SupportedExpressionPropertyTypes } from '../constants/expression';
import type { IDBConnection } from '../database/db';
import { ApiValidationError } from '../errors/api-error';
import type {
  InternalTimestampPredicate,
  InternalTypedPredicate,
  PredicateOperator,
  PredicatePropertyTypeName
} from '../models/expression-predicate';
import type { ExpressionTree, ExpressionTreeClause, ExpressionTreePredicate } from '../models/expression-tree';
import type {
  NormalizedExpressionTree,
  NormalizedExpressionTreeClause,
  NormalizedExpressionTreePredicate
} from '../models/expression-tree-internal';
import { FEATURE_PROPERTY_TYPE } from '../models/feature-property';
import type { ExpressionPredicatePropertyMetadata } from '../models/feature-type-property';
import { ItisTsnLookupValue, type FindTaxonFilters } from '../models/taxon';
import { FeatureTypePropertyRepository } from '../repositories/feature-type-property-repository';
import { parseTimestamp } from '../utils/timestamp';
import { GeoJSONGeometryZodSchema } from '../zod-schema/geoJsonZodSchema';
import { TaxonomyService } from './taxonomy-service';

/**
 * Converts a structurally valid public expression tree into its canonical internal form.
 *
 * The service flattens associative expressions, orders clauses deterministically, resolves property metadata,
 * validates operator and value semantics, and builds the typed predicates used by persistence and SQL generation.
 * Logical simplification remains the responsibility of the expression optimization utility.
 */
export class ExpressionTreeNormalizationService {
  featureTypePropertyRepository: FeatureTypePropertyRepository;
  taxonomyService: TaxonomyService;

  /**
   * Builds an expression-tree normalization service.
   *
   * @param {IDBConnection} connection - Active database connection.
   */
  constructor(connection: IDBConnection) {
    this.featureTypePropertyRepository = new FeatureTypePropertyRepository(connection);
    this.taxonomyService = new TaxonomyService(connection);
  }

  /**
   * Canonicalizes an expression tree and resolves every predicate's database-backed semantics.
   *
   * Repeated predicates referring to the same property share one metadata lookup during this normalization call.
   *
   * @example
   * Input:  AND(Count > 7, AND(Count < 9, Count > 7))
   * Output: AND(Count > 7, Count > 7, Count < 9), with resolved property metadata and typed numeric payloads attached.
   *
   * Duplicate removal is deliberately deferred to `optimizeExpression`; normalization only makes equivalent structure
   * and typed predicate values deterministic.
   *
   * @param {ExpressionTree} expression - Structurally validated public expression tree.
   * @return {Promise<NormalizedExpressionTree>} Canonical expression with resolved, typed predicates.
   */
  async normalize(expression: ExpressionTree): Promise<NormalizedExpressionTree> {
    const metadataByProperty = new Map<string, Promise<ExpressionPredicatePropertyMetadata>>();
    return this.normalizeExpression(this.normalizeStructure(expression), metadataByProperty);
  }

  /**
   * Recursively flattens nested expressions that use the same logical operator and orders their clauses.
   *
   * Duplicate clauses are intentionally preserved for the later optimization stage.
   *
   * @example
   * Input:  AND(A, AND(C, B), OR(D, E))
   * Output: AND(A, B, C, OR(D, E))
   *
   * The nested AND is associative and can be flattened. The nested OR remains intact because crossing that boundary
   * would change the expression's semantics.
   *
   * @param {ExpressionTree} expression - Public expression node to canonicalize.
   * @return {ExpressionTree} Structurally canonical expression tree.
   */
  private normalizeStructure(expression: ExpressionTree): ExpressionTree {
    const clauses = expression.clauses.flatMap((clause) => {
      if (clause.type === 'predicate') {
        return [clause];
      }

      const normalizedExpression = this.normalizeStructure(clause);
      return normalizedExpression.operator === expression.operator
        ? normalizedExpression.clauses
        : [normalizedExpression];
    });

    clauses.sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right), undefined, { numeric: true })
    );

    return { ...expression, clauses };
  }

  /**
   * Resolves all predicates in a structurally canonical expression tree.
   *
   * @param {ExpressionTree} expression - Structurally canonical expression tree.
   * @param {Map<string, Promise<ExpressionPredicatePropertyMetadata>>} metadataByProperty - Request-local metadata cache.
   * @return {Promise<NormalizedExpressionTree>} Expression containing resolved, typed predicates.
   */
  private async normalizeExpression(
    expression: ExpressionTree,
    metadataByProperty: Map<string, Promise<ExpressionPredicatePropertyMetadata>>
  ): Promise<NormalizedExpressionTree> {
    return {
      type: 'expression',
      operator: expression.operator,
      clauses: await Promise.all(expression.clauses.map((clause) => this.normalizeClause(clause, metadataByProperty)))
    };
  }

  /**
   * Normalizes one expression clause.
   *
   * Recurses through nested expressions and delegates predicate leaves to metadata-backed validation.
   *
   * @param {ExpressionTreeClause} clause - Expression or predicate clause.
   * @param {Map<string, Promise<ExpressionPredicatePropertyMetadata>>} metadataByProperty - Request-local metadata cache.
   * @return {Promise<NormalizedExpressionTreeClause>} Normalized clause.
   * @private
   * @memberof ExpressionTreeNormalizationService
   */
  private async normalizeClause(
    clause: ExpressionTreeClause,
    metadataByProperty: Map<string, Promise<ExpressionPredicatePropertyMetadata>>
  ): Promise<NormalizedExpressionTreeClause> {
    if (clause.type === 'expression') {
      return this.normalizeExpression(clause, metadataByProperty);
    }

    return this.normalizePredicate(clause, metadataByProperty);
  }

  /**
   * Normalizes one predicate leaf.
   *
   * Resolves the selected property, verifies operator compatibility, validates the value, and attaches the internal
   * typed predicate used by hashing, persistence, and search SQL.
   *
   * @example
   * Input:  `{ feature_property_id: 14, operator: 'GreaterThan', value: 7 }`
   * Output: the same public fields plus resolved number-property metadata and
   * `{ internal_predicate: { type: 'number', operator: 'GreaterThan', value: 7 } }`.
   *
   * @param {ExpressionTreePredicate} predicate - Public predicate leaf.
   * @param {Map<string, Promise<ExpressionPredicatePropertyMetadata>>} metadataByProperty - Request-local metadata cache.
   * @return {Promise<NormalizedExpressionTreePredicate>} Predicate with resolved property metadata and internal value.
   * @private
   * @memberof ExpressionTreeNormalizationService
   */
  private async normalizePredicate(
    predicate: ExpressionTreePredicate,
    metadataByProperty: Map<string, Promise<ExpressionPredicatePropertyMetadata>>
  ): Promise<NormalizedExpressionTreePredicate> {
    const metadata = await this.getPropertyMetadata(predicate, metadataByProperty);

    if (!SupportedExpressionPropertyTypes.has(metadata.feature_property_type_name)) {
      throw new ApiValidationError('Unsupported predicate property type', [
        'ExpressionTreeNormalizationService->normalizePredicate',
        { featurePropertyTypeName: metadata.feature_property_type_name }
      ]);
    }

    const propertyType: PredicatePropertyTypeName = metadata.feature_property_type_name;
    const allowedOperators: readonly PredicateOperator[] = OperatorsByPropertyType[propertyType];

    if (!allowedOperators.includes(predicate.operator)) {
      throw new ApiValidationError('Predicate operator is not valid for property type', [
        'ExpressionTreeNormalizationService->normalizePredicate',
        { operator: predicate.operator, propertyType }
      ]);
    }

    const internal_predicate = await this.buildInternalPredicate(predicate, propertyType);

    return {
      ...predicate,
      feature_property_type_id: metadata.feature_property_type_id,
      feature_property_type_name: propertyType,
      internal_predicate
    };
  }

  /**
   * Resolves property metadata once for each concrete property identity in a normalization call.
   *
   * Promise values are cached before awaiting them so concurrently normalized sibling predicates share the same
   * database request.
   *
   * @example
   * Predicates `(14, null)` and `(14, null)` share one cached lookup. Predicates `(14, 108)` and `(14, 109)` use
   * separate lookups because they identify different concrete assignments.
   *
   * @param {ExpressionTreePredicate} predicate - Predicate whose property metadata is required.
   * @param {Map<string, Promise<ExpressionPredicatePropertyMetadata>>} metadataByProperty - Request-local metadata cache.
   * @return {Promise<ExpressionPredicatePropertyMetadata>} Active metadata matching the predicate's property identity.
   */
  private getPropertyMetadata(
    predicate: ExpressionTreePredicate,
    metadataByProperty: Map<string, Promise<ExpressionPredicatePropertyMetadata>>
  ): Promise<ExpressionPredicatePropertyMetadata> {
    const identity = `${predicate.feature_property_id}:${predicate.feature_type_property_id ?? ''}`;
    const cachedMetadata = metadataByProperty.get(identity);

    if (cachedMetadata) {
      return cachedMetadata;
    }

    const metadata = this.featureTypePropertyRepository.getExpressionPredicatePropertyMetadata(
      predicate.feature_property_id,
      predicate.feature_type_property_id
    );
    metadataByProperty.set(identity, metadata);
    return metadata;
  }

  /**
   * Convert a public predicate value to an internal typed predicate payload.
   *
   * `Exists` is validated before type-specific value checks, then routed through the same property type switch.
   *
   * @param {ExpressionTreePredicate} predicate - Public predicate leaf.
   * @param {PredicatePropertyTypeName} propertyType - Resolved property type name.
   * @return {Promise<InternalTypedPredicate>} Repository-ready predicate payload.
   * @private
   * @memberof ExpressionTreeNormalizationService
   */
  private async buildInternalPredicate(
    predicate: ExpressionTreePredicate,
    propertyType: PredicatePropertyTypeName
  ): Promise<InternalTypedPredicate> {
    // Exists means "has a value row"; typed value columns remain null.
    if (predicate.operator === 'Exists') {
      if (predicate.value !== undefined) {
        throw new ApiValidationError('Exists predicates must not include a value', [
          'ExpressionTreeNormalizationService->buildInternalPredicate',
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
        return { type: 'taxon', operator: predicate.operator, value: await this.resolveTaxonValue(predicate) };
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
   * @memberof ExpressionTreeNormalizationService
   */
  private requireStringValue(predicate: ExpressionTreePredicate): string {
    if (typeof predicate.value !== 'string' || predicate.value.length > 250) {
      throw new ApiValidationError('Predicate value must be a string with max length 250', [
        'ExpressionTreeNormalizationService->requireStringValue',
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
   * @memberof ExpressionTreeNormalizationService
   */
  private requireNumberValue(predicate: ExpressionTreePredicate): number {
    if (typeof predicate.value !== 'number') {
      throw new ApiValidationError('Predicate value must be a number', [
        'ExpressionTreeNormalizationService->requireNumberValue',
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
   * @memberof ExpressionTreeNormalizationService
   */
  private requireBooleanValue(predicate: ExpressionTreePredicate): boolean {
    if (typeof predicate.value !== 'boolean') {
      throw new ApiValidationError('Predicate value must be a boolean', [
        'ExpressionTreeNormalizationService->requireBooleanValue',
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
   * @memberof ExpressionTreeNormalizationService
   */
  private requirePositiveIntegerValue(predicate: ExpressionTreePredicate): number {
    if (typeof predicate.value !== 'number' || !Number.isInteger(predicate.value) || predicate.value <= 0) {
      throw new ApiValidationError('Predicate value must be a positive integer', [
        'ExpressionTreeNormalizationService->requirePositiveIntegerValue',
        { predicate }
      ]);
    }

    return predicate.value;
  }

  /**
   * Resolve a taxon predicate value to an internal taxon id.
   *
   * The client-supplied value is an ITIS TSN (numeric or digit-only string) or an exact scientific name (string), not
   * an internal `taxon_id`. Resolution is intentionally limited to locally stored taxa.
   *
   * @param {ExpressionTreePredicate} predicate - Public taxon predicate leaf.
   * @return {Promise<number>} Resolved taxon id.
   * @private
   * @memberof ExpressionTreeNormalizationService
   */
  private async resolveTaxonValue(predicate: ExpressionTreePredicate): Promise<number> {
    const value = typeof predicate.value === 'string' ? predicate.value.trim() : predicate.value;
    let filters: FindTaxonFilters;

    if (typeof value === 'string' && !/^\d+$/.test(value)) {
      filters = { itis_scientific_name: value };
    } else {
      const parseResult = ItisTsnLookupValue.safeParse(value);

      if (!parseResult.success) {
        throw new ApiValidationError('Predicate value must be a valid ITIS TSN', [
          'ExpressionTreeNormalizationService->resolveTaxonValue',
          { predicate }
        ]);
      }

      filters = { itis_tsn: parseResult.data };
    }

    const records = await this.taxonomyService.findTaxon(filters);

    if (records.length !== 1) {
      throw new ApiValidationError(records.length ? 'Taxon value matched multiple taxa' : 'Taxon not found', [
        'ExpressionTreeNormalizationService->resolveTaxonValue',
        { predicate, matches: records.length }
      ]);
    }

    return records[0].taxon_id;
  }

  /**
   * Require a valid GeoJSON geometry predicate value.
   *
   * Spatial values already have a dedicated Zod schema, so complex shape validation is delegated there.
   *
   * @param {ExpressionTreePredicate} predicate - Public predicate leaf.
   * @return {unknown} Validated GeoJSON geometry value.
   * @private
   * @memberof ExpressionTreeNormalizationService
   */
  private requireGeometryValue(predicate: ExpressionTreePredicate): unknown {
    // Keep spatial validation aligned with the rest of the API by reusing the shared GeoJSON schema.
    const result = GeoJSONGeometryZodSchema.safeParse(predicate.value);

    if (!result.success) {
      throw new ApiValidationError('Predicate value must be a valid GeoJSON geometry', [
        'ExpressionTreeNormalizationService->requireGeometryValue',
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
   * @example
   * Input:  `After('2024-02-29T14:30:00Z')`
   * Output: `{ type: 'timestamp', operator: 'After', value: {
   *   date_value: '2024-02-29', time_value: '14:30:00Z'
   * } }`
   *
   * Date-only and time-only inputs set the inapplicable component to null. `OnDate` accepts only date-only input and
   * `OnTime` accepts only time-only input.
   *
   * @param {ExpressionTreePredicate} predicate - Public datetime predicate leaf.
   * @return {InternalTimestampPredicate} Internal timestamp predicate payload.
   * @private
   * @memberof ExpressionTreeNormalizationService
   */
  private buildTimestampPredicate(predicate: ExpressionTreePredicate): InternalTimestampPredicate {
    if (typeof predicate.value !== 'string') {
      throw new ApiValidationError('Datetime predicate value must be a scalar string', [
        'ExpressionTreeNormalizationService->buildTimestampPredicate',
        { predicate }
      ]);
    }

    // Parse first so format errors are distinct from operator-kind errors.
    const parsed = parseTimestamp(predicate.value);

    if (!parsed) {
      throw new ApiValidationError('Datetime predicate value is not a supported temporal literal', [
        'ExpressionTreeNormalizationService->buildTimestampPredicate',
        { value: predicate.value }
      ]);
    }

    // OnDate and OnTime intentionally require strict scalar kinds.
    if (predicate.operator === 'OnDate' && parsed.kind !== 'date') {
      throw new ApiValidationError('OnDate requires a date-only temporal literal', [
        'ExpressionTreeNormalizationService->buildTimestampPredicate',
        { value: predicate.value }
      ]);
    }

    if (predicate.operator === 'OnTime' && parsed.kind !== 'time') {
      throw new ApiValidationError('OnTime requires a time-only temporal literal', [
        'ExpressionTreeNormalizationService->buildTimestampPredicate',
        { value: predicate.value }
      ]);
    }

    // The registry should prevent this path, but keep the guard close to timestamp normalization.
    if (!['Before', 'After', 'OnDate', 'OnTime'].includes(predicate.operator)) {
      throw new ApiValidationError('Unsupported datetime predicate operator', [
        'ExpressionTreeNormalizationService->buildTimestampPredicate',
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
