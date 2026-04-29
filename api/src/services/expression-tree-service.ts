import { createHash } from 'node:crypto';
import { IDBConnection } from '../database/db';
import { ApiGeneralError } from '../errors/api-error';
import type { InternalTypedPredicate } from '../models/expression-predicate';
import type {
  ExpressionTree,
  ExpressionTreeExpression,
  ExpressionTreePredicate as ExpressionTreePredicateType
} from '../models/expression-tree';
import { ExpressionTreePredicate } from '../models/expression-tree';
import {
  NormalizedExpressionTreeExpression,
  NormalizedExpressionTreePredicate
} from '../models/expression-tree-internal';
import type { LogicalOperator } from '../models/logical-operator';
import type { ReadPredicateNodeRow } from '../models/predicate';
import { ExpressionClauseRepository } from '../repositories/expression-clause-repository';
import { ExpressionRepository } from '../repositories/expression-repository';
import { PredicateRepository } from '../repositories/predicate-repository';
import { parseTimestamp } from '../utils/timestamp';
import { DBService } from './db-service';
import { ExpressionPredicateSemanticValidator } from './expression-predicate-semantic-validator';
import type {
  ExpressionHashClause,
  ExpressionTreeClauseWithHash,
  ExpressionTreeExpressionWithHash,
  ExpressionTreePredicateWithHash,
  ReadExpressionClause,
  WriteExpressionClause
} from './expression-tree-service.interface';

/**
 * Service for writing and reading reusable expression trees.
 *
 * Core responsibilities:
 * 1. Normalize and hash expression/predicate nodes deterministically.
 * 2. Reuse existing anchors by hash when possible (dedupe by semantic identity).
 * 3. Insert missing expression/predicate anchors and clause edges when needed.
 * 4. Reconstruct a stored expression tree back into API shape.
 * Important design detail:
 * Hashes are semantic, not positional row IDs. This lets us share immutable
 * expression fragments across requests while preserving full tree
 * structure through `expression_clause` ordering.
 */
export class ExpressionTreeService extends DBService {
  expressionRepository: ExpressionRepository;
  expressionClauseRepository: ExpressionClauseRepository;
  predicateRepository: PredicateRepository;
  semanticValidator: ExpressionPredicateSemanticValidator;

  /**
   * Build an expression-tree lifecycle service.
   *
   * @param {IDBConnection} connection - Active database connection.
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.expressionRepository = new ExpressionRepository(connection);
    this.expressionClauseRepository = new ExpressionClauseRepository(connection);
    this.predicateRepository = new PredicateRepository(connection);
    this.semanticValidator = new ExpressionPredicateSemanticValidator(connection);
  }

  /**
   * Persist an expression tree and return the resolved root expression id.
   *
   * Flow:
   * 1. Compute deterministic hashes for all nodes in the tree.
   * 2. Load existing expression/predicate ids by those hashes in bulk.
   * 3. Resolve recursively, inserting only missing anchors/clauses.
   *
   * @param {ExpressionTree} tree - Root expression tree payload to persist.
   * @return {Promise<{ expression_id: string }>} Resolved root expression id.
   * @memberof ExpressionTreeService
   */
  async writeExpressionTree(tree: ExpressionTree): Promise<{ expression_id: string }> {
    const normalizedTree = await this.semanticValidator.validateExpressionTree(tree);
    const hashedTree = this.buildHashedTreeFromExpression(normalizedTree);
    const { predicateIdsByHash, expressionIdsByHash } = await this.loadExistingIdsByHash(hashedTree);
    const expressionId = await this.resolveExpressionNode(hashedTree, predicateIdsByHash, expressionIdsByHash);
    return { expression_id: expressionId };
  }

  /**
   * Read a stored expression tree by root expression id.
   *
   * @param {string} expressionId - Root expression identifier.
   * @return {Promise<ExpressionTree>} Reconstructed API tree.
   * @memberof ExpressionTreeService
   */
  async readExpressionTree(expressionId: string): Promise<ExpressionTree> {
    return this.reconstructExpressionTreeFromStorage(expressionId, new Set<string>());
  }

  /**
   * Reconstruct an expression node recursively from storage rows.
   *
   * This routine:
   * 1. Guards against cycles during traversal (defensive check in service layer).
   * 2. Loads expression anchor + ordered clause links.
   * 3. Hydrates predicate clauses in batch per expression node.
   * 4. Re-enters recursively for child expression clauses.
   *
   * @private
   * @param {string} expressionId - Expression id to reconstruct.
   * @param {Set<string>} visitedExpressionIds - Path-local set used for cycle detection.
   * @return {Promise<ExpressionTreeExpression>} Reconstructed expression node.
   * @memberof ExpressionTreeService
   */
  private async reconstructExpressionTreeFromStorage(
    expressionId: string,
    visitedExpressionIds: Set<string>
  ): Promise<ExpressionTreeExpression> {
    if (visitedExpressionIds.has(expressionId)) {
      throw new ApiGeneralError('Cycle detected in expression tree', [
        'ExpressionTreeService->reconstructExpressionTreeFromStorage',
        `expressionId=${expressionId}`
      ]);
    }

    const nextVisitedExpressionIds = new Set(visitedExpressionIds);
    nextVisitedExpressionIds.add(expressionId);

    // Anchor row (operator) for this expression node.
    const expression = await this.expressionRepository.getExpressionById(expressionId);

    // Ordered edges to either predicates or child expressions.
    const links = await this.expressionClauseRepository.getExpressionClausesByExpressionId(expressionId);

    if (links.length === 0) {
      throw new ApiGeneralError('Expression has no active clauses', [
        'ExpressionTreeService->reconstructExpressionTreeFromStorage',
        `expressionId=${expressionId}`
      ]);
    }

    const predicateIds = links.map((link) => link.predicate_id).filter((value): value is string => !!value);

    // Batch-read all predicate payload rows referenced by this expression node.
    const readPredicates = await this.predicateRepository.readPredicateNodes(predicateIds);
    const predicatesById = new Map(readPredicates.map((row) => [row.predicate_id, row]));

    const readClauses: ReadExpressionClause[] = [];

    for (const link of links) {
      if (link.predicate_id) {
        const predicateRow = predicatesById.get(link.predicate_id);

        if (!predicateRow) {
          throw new ApiGeneralError('Missing predicate row while reconstructing expression tree', [
            'ExpressionTreeService->reconstructExpressionTreeFromStorage',
            `predicateId=${link.predicate_id}`,
            `expressionId=${expressionId}`
          ]);
        }

        readClauses.push({
          sequence: link.sequence,
          clause: this.parseReadPredicateRow(predicateRow, link.predicate_id)
        });
        continue;
      }

      if (!link.child_expression_id) {
        throw new ApiGeneralError('Invalid expression clause target', [
          'ExpressionTreeService->reconstructExpressionTreeFromStorage',
          `expressionClauseId=${link.expression_clause_id}`
        ]);
      }

      readClauses.push({
        sequence: link.sequence,
        // Recurse into child expression branch.
        clause: await this.reconstructExpressionTreeFromStorage(link.child_expression_id, nextVisitedExpressionIds)
      });
    }

    return {
      type: 'expression',
      operator: expression.operator,
      // Storage is expected to be ordered by sequence, but sort defensively.
      clauses: readClauses.toSorted((a, b) => a.sequence - b.sequence).map((entry) => entry.clause)
    };
  }

  /**
   * Deterministically stringify arbitrary JSON-like values.
   *
   * Keys are sorted recursively so semantically equivalent objects hash to the same value
   * regardless of source key order.
   *
   * @private
   * @param {unknown} value - Value to stringify.
   * @return {string} Stable JSON-like string.
   * @memberof ExpressionTreeService
   */
  private stableStringify(value: unknown): string {
    if (value === null) {
      return 'null';
    }

    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    }

    if (typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
      const serializedEntries = entries.map(([key, val]) => JSON.stringify(key) + ':' + this.stableStringify(val));
      return '{' + serializedEntries.join(',') + '}';
    }

    return JSON.stringify(value);
  }

  /**
   * Compute a SHA-256 hex digest for a normalized identity string.
   *
   * @private
   * @param {string} value - Canonical identity string.
   * @return {string} SHA-256 hash in hex form.
   * @memberof ExpressionTreeService
   */
  private computeHash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  /**
   * Normalize case-insensitive text before hashing.
   *
   * Uses NFKC normalization and lower-casing so equivalent Unicode forms and case
   * variants collapse to the same semantic identity.
   *
   * @private
   * @param {string} value - Source string.
   * @return {string} Normalized string.
   * @memberof ExpressionTreeService
   */
  private normalizeCaseInsensitiveText(value: string): string {
    return value.normalize('NFKC').toLowerCase();
  }

  /**
   * Check whether a string operator should hash case-insensitively.
   *
   * @private
   * @param {Extract<InternalTypedPredicate, { type: 'string' }>['operator']} operator - String operator.
   * @return {boolean} True when values should be normalized to case-insensitive form.
   * @memberof ExpressionTreeService
   */
  private isCaseInsensitiveStringOperator(
    operator: Extract<InternalTypedPredicate, { type: 'string' }>['operator']
  ): boolean {
    return operator === 'ILike';
  }

  /**
   * Normalize a string predicate value for semantic hashing.
   *
   * @private
   * @param {Extract<InternalTypedPredicate, { type: 'string' }>} predicate - String predicate payload.
   * @return {string} Normalized value, or empty string when value is absent.
   * @memberof ExpressionTreeService
   */
  private normalizeStringPredicateValue(predicate: Extract<InternalTypedPredicate, { type: 'string' }>): string {
    if (predicate.value === undefined) {
      return '';
    }

    if (this.isCaseInsensitiveStringOperator(predicate.operator)) {
      return this.normalizeCaseInsensitiveText(predicate.value);
    }

    return predicate.value.normalize('NFKC');
  }

  /**
   * Normalize a boolean predicate value for semantic hashing.
   *
   * @private
   * @param {Extract<InternalTypedPredicate, { type: 'boolean' }>} predicate - Boolean predicate payload.
   * @return {string} Normalized value, or empty string when value is absent.
   * @memberof ExpressionTreeService
   */
  private normalizeBooleanPredicateValue(predicate: Extract<InternalTypedPredicate, { type: 'boolean' }>): string {
    if (predicate.value === undefined) {
      return '';
    }

    return predicate.value ? 'true' : 'false';
  }

  /**
   * Build canonical predicate identity text from shared and type-specific parts.
   *
   * @private
   * @param {number} featurePropertyId - Shared feature property identifier.
   * @param {number | null} featureTypePropertyId - Optional feature type property identifier.
   * @param {number} featurePropertyTypeId - Resolved feature property type identifier.
   * @param {string} operator - Predicate operator.
   * @param {Record<string, string | number>} fields - Additional canonical key/value fields.
   * @return {string} Canonical identity string.
   * @memberof ExpressionTreeService
   */
  private buildPredicateIdentity(
    featurePropertyId: number,
    featureTypePropertyId: number | null,
    featurePropertyTypeId: number,
    operator: string,
    fields: Record<string, string | number>
  ): string {
    const parts = [
      'predicate',
      `fp=${featurePropertyId}`,
      `ftp=${featureTypePropertyId ?? ''}`,
      `fpt=${featurePropertyTypeId}`,
      `op=${operator}`
    ];

    for (const [field, value] of Object.entries(fields)) {
      parts.push(`${field}=${String(value)}`);
    }

    return parts.join('|');
  }

  /**
   * Build canonical predicate identity text used for semantic hashing.
   *
   * Canonicalization is type-aware:
   * - string: supports case-insensitive normalization for ILike.
   * - number: normalized through JS number stringify.
   * - geometry/object-like values: stabilized via sorted-key stringify.
   * - optional values (e.g., Exists): serialized as empty markers.
   *
   * @private
   * @param {NormalizedExpressionTreePredicate} clause - Predicate clause.
   * @return {string} Canonical identity string for hash input.
   * @memberof ExpressionTreeService
   */
  private buildNormalizedPredicateIdentityForHash(clause: NormalizedExpressionTreePredicate): string {
    const {
      feature_property_id,
      feature_type_property_id,
      feature_property_type_id,
      internal_predicate: predicate
    } = clause;

    switch (predicate.type) {
      case 'string':
        return this.buildPredicateIdentity(
          feature_property_id,
          feature_type_property_id,
          feature_property_type_id,
          predicate.operator,
          {
            value: this.normalizeStringPredicateValue(predicate)
          }
        );
      case 'number':
        return this.buildPredicateIdentity(
          feature_property_id,
          feature_type_property_id,
          feature_property_type_id,
          predicate.operator,
          {
            value: predicate.value === undefined ? '' : Number(predicate.value).toString()
          }
        );
      case 'boolean':
        return this.buildPredicateIdentity(
          feature_property_id,
          feature_type_property_id,
          feature_property_type_id,
          predicate.operator,
          {
            value: this.normalizeBooleanPredicateValue(predicate)
          }
        );
      case 'timestamp':
        if (predicate.value === undefined) {
          return this.buildPredicateIdentity(
            feature_property_id,
            feature_type_property_id,
            feature_property_type_id,
            predicate.operator,
            {
              date: '',
              time: ''
            }
          );
        }

        const parsedTimestamp = parseTimestamp(predicate.value);

        if (!parsedTimestamp) {
          throw new ApiGeneralError('Unsupported timestamp predicate value for normalization', [
            'ExpressionTreeService->buildNormalizedPredicateIdentityForHash',
            { value: predicate.value }
          ]);
        }

        return this.buildPredicateIdentity(
          feature_property_id,
          feature_type_property_id,
          feature_property_type_id,
          predicate.operator,
          {
            date: parsedTimestamp.date_value ?? '',
            time: parsedTimestamp.time_value ?? ''
          }
        );
      case 'taxon':
        return this.buildPredicateIdentity(
          feature_property_id,
          feature_type_property_id,
          feature_property_type_id,
          predicate.operator,
          {
            value: predicate.value ?? ''
          }
        );
      case 'geometry':
        return this.buildPredicateIdentity(
          feature_property_id,
          feature_type_property_id,
          feature_property_type_id,
          predicate.operator,
          {
            value: predicate.value === undefined ? '' : this.stableStringify(predicate.value)
          }
        );
      case 'code':
        return this.buildPredicateIdentity(
          feature_property_id,
          feature_type_property_id,
          feature_property_type_id,
          predicate.operator,
          {
            value: predicate.value ?? ''
          }
        );
      default: {
        const exhaustiveType: never = predicate;
        throw new ApiGeneralError('Unsupported predicate type for normalization', [
          'ExpressionTreeService->buildNormalizedPredicateIdentityForHash',
          { exhaustiveType }
        ]);
      }
    }
  }

  /**
   * Build canonical expression identity text used for semantic hashing.
   *
   * Clauses are represented as ordered hash references (sequence + type + child hash),
   * so parent expression identity captures tree shape and clause order.
   *
   * @private
   * @param {LogicalOperator} operator - Expression operator.
   * @param {ExpressionHashClause[]} clauses - Ordered hashed child references.
   * @return {string} Canonical identity string for hash input.
   * @memberof ExpressionTreeService
   */
  private buildNormalizedExpressionIdentityForHash(operator: LogicalOperator, clauses: ExpressionHashClause[]): string {
    return this.stableStringify({
      type: 'expression',
      operator,
      clauses
    });
  }

  /**
   * Convert an expression tree into a structurally equivalent tree with hashes at every node.
   *
   * Predicate hashes are derived from normalized predicate identities.
   * Expression hashes are derived from operator + ordered child hash references.
   *
   * @private
   * @param {NormalizedExpressionTreeExpression} expression - Expression tree node.
   * @return {ExpressionTreeExpressionWithHash} Hashed expression node.
   * @memberof ExpressionTreeService
   */
  private buildHashedTreeFromExpression(
    expression: NormalizedExpressionTreeExpression
  ): ExpressionTreeExpressionWithHash {
    const hashedClauses: ExpressionTreeClauseWithHash[] = expression.clauses.map(
      (clause): ExpressionTreeClauseWithHash => {
        if (clause.type === 'predicate') {
          const hash = this.computeHash(this.buildNormalizedPredicateIdentityForHash(clause));
          return {
            ...clause,
            hash
          };
        }

        // Recurse for child expressions first so child hashes are available.
        return this.buildHashedTreeFromExpression(clause);
      }
    );

    const hashClauses: ExpressionHashClause[] = hashedClauses.map((clause, index) => ({
      sequence: index + 1,
      clause_type: clause.type,
      clause_hash: clause.hash
    }));

    const hash = this.computeHash(this.buildNormalizedExpressionIdentityForHash(expression.operator, hashClauses));

    return {
      type: 'expression',
      hash,
      operator: expression.operator,
      clauses: hashedClauses
    };
  }

  /**
   * Collect all predicate and expression hashes from a hashed tree.
   *
   * Used to perform bulk lookups of existing anchors before recursive resolve.
   *
   * @private
   * @param {ExpressionTreeExpressionWithHash} expression - Root hashed expression.
   * @param {Set<string>} predicateHashes - Accumulator for predicate hashes.
   * @param {Set<string>} expressionHashes - Accumulator for expression hashes.
   * @return {void}
   * @memberof ExpressionTreeService
   */
  private collectTreeHashes(
    expression: ExpressionTreeExpressionWithHash,
    predicateHashes: Set<string>,
    expressionHashes: Set<string>
  ): void {
    expressionHashes.add(expression.hash);

    for (const clause of expression.clauses) {
      if (clause.type === 'predicate') {
        predicateHashes.add(clause.hash);
        continue;
      }

      this.collectTreeHashes(clause, predicateHashes, expressionHashes);
    }
  }

  /**
   * Load existing predicate/expression ids by hash in bulk.
   *
   * This reduces write path chatter by front-loading hash lookups once per tree.
   *
   * @private
   * @param {ExpressionTreeExpressionWithHash} root - Root hashed tree.
   * @return {Promise<{ predicateIdsByHash: Map<string, string>; expressionIdsByHash: Map<string, string> }>}
   * Hash-index maps for existing anchors.
   * @memberof ExpressionTreeService
   */
  private async loadExistingIdsByHash(
    root: ExpressionTreeExpressionWithHash
  ): Promise<{ predicateIdsByHash: Map<string, string>; expressionIdsByHash: Map<string, string> }> {
    const predicateHashes = new Set<string>();
    const expressionHashes = new Set<string>();
    this.collectTreeHashes(root, predicateHashes, expressionHashes);

    // Parallel hash lookups for both anchor types.
    const [existingPredicates, existingExpressions] = await Promise.all([
      this.predicateRepository.getPredicatesByHashes([...predicateHashes]),
      this.expressionRepository.getExpressionsByHashes([...expressionHashes])
    ]);

    return {
      predicateIdsByHash: new Map(existingPredicates.map((row) => [row.predicate_hash, row.predicate_id])),
      expressionIdsByHash: new Map(existingExpressions.map((row) => [row.expression_hash, row.expression_id]))
    };
  }

  /**
   * Resolve a predicate clause to a predicate id (reuse-or-insert).
   *
   * Concurrency-safe flow:
   * 1. Reuse preloaded id when present.
   * 2. Upsert anchor by hash and return resolved id + insert-state.
   * 3. Write typed payload row only when the anchor is newly inserted.
   *
   * @private
   * @param {ExpressionTreePredicateWithHash} clause - Hashed predicate clause.
   * @param {Map<string, string>} predicateIdsByHash - Mutable in-memory hash->id cache.
   * @return {Promise<string>} Resolved predicate id.
   * @memberof ExpressionTreeService
   */
  private async resolvePredicateNode(
    clause: ExpressionTreePredicateWithHash,
    predicateIdsByHash: Map<string, string>
  ): Promise<string> {
    const existingPredicateId = predicateIdsByHash.get(clause.hash);
    if (existingPredicateId) {
      return existingPredicateId;
    }

    const resolvedPredicate = await this.predicateRepository.insertPredicateAnchor({
      feature_property_id: clause.feature_property_id,
      feature_type_property_id: clause.feature_type_property_id,
      feature_property_type_id: clause.feature_property_type_id,
      predicate_hash: clause.hash
    });

    if (resolvedPredicate.inserted) {
      // Payload write is only needed on first creation of the predicate anchor.
      await this.predicateRepository.writePredicatePayload(resolvedPredicate.predicate_id, clause.internal_predicate);
    }

    predicateIdsByHash.set(clause.hash, resolvedPredicate.predicate_id);
    return resolvedPredicate.predicate_id;
  }

  /**
   * Resolve an expression node to an expression id (reuse-or-insert), recursively.
   *
   * Steps:
   * 1. Reuse existing anchor when hash is already known.
   * 2. Resolve child clauses (predicate ids / child expression ids).
   * 3. Upsert expression anchor by hash.
   * 4. Insert clause edges only when the anchor is newly inserted.
   *
   * @private
   * @param {ExpressionTreeExpressionWithHash} expression - Hashed expression node.
   * @param {Map<string, string>} predicateIdsByHash - Mutable predicate hash cache.
   * @param {Map<string, string>} expressionIdsByHash - Mutable expression hash cache.
   * @return {Promise<string>} Resolved expression id.
   * @memberof ExpressionTreeService
   */
  private async resolveExpressionNode(
    expression: ExpressionTreeExpressionWithHash,
    predicateIdsByHash: Map<string, string>,
    expressionIdsByHash: Map<string, string>
  ): Promise<string> {
    const existingExpressionId = expressionIdsByHash.get(expression.hash);
    if (existingExpressionId) {
      return existingExpressionId;
    }

    const resolvedClauses: WriteExpressionClause[] = [];

    for (const [index, clause] of expression.clauses.entries()) {
      if (clause.type === 'predicate') {
        const predicateId = await this.resolvePredicateNode(clause, predicateIdsByHash);
        resolvedClauses.push({
          sequence: index + 1,
          predicate_id: predicateId,
          child_expression_id: null
        });
        continue;
      }

      // Resolve child expression first so we can write a child edge by id.
      const childExpressionId = await this.resolveExpressionNode(clause, predicateIdsByHash, expressionIdsByHash);
      resolvedClauses.push({
        sequence: index + 1,
        predicate_id: null,
        child_expression_id: childExpressionId
      });
    }

    const resolvedExpression = await this.expressionRepository.insertExpressionAnchor(
      expression.operator,
      expression.hash
    );

    expressionIdsByHash.set(expression.hash, resolvedExpression.expression_id);

    if (resolvedExpression.inserted) {
      // Clauses are immutable for a given semantic hash; write only on first insert.
      await this.expressionClauseRepository.insertExpressionClauses(
        resolvedClauses.map((clause) => ({
          expression_id: resolvedExpression.expression_id,
          ...clause
        }))
      );
    }

    return resolvedExpression.expression_id;
  }

  /**
   * Parse and validate a repository predicate read row into API predicate node shape.
   *
   * Integrity expectations from SQL read shape:
   * - payload_count must equal 1
   * - predicate_node must be present and parse as ExpressionTreePredicate
   *
   * @private
   * @param {ReadPredicateNodeRow} row - Read row from predicate repository.
   * @param {string} predicateId - Predicate id for diagnostics.
   * @return {ExpressionTreePredicate} Parsed predicate node.
   * @memberof ExpressionTreeService
   */
  private parseReadPredicateRow(row: ReadPredicateNodeRow, predicateId: string): ExpressionTreePredicateType {
    if (row.payload_count !== 1 || !row.predicate_node) {
      throw new ApiGeneralError('Invalid predicate payload integrity', [
        'ExpressionTreeService->parseReadPredicateRow',
        { predicateId, payload_count: row.payload_count }
      ]);
    }

    try {
      return ExpressionTreePredicate.parse(row.predicate_node);
    } catch (error) {
      throw new ApiGeneralError('Invalid read predicate node shape', [
        'ExpressionTreeService->parseReadPredicateRow',
        {
          predicateId,
          payload_count: row.payload_count,
          predicate_node: row.predicate_node,
          error: error instanceof Error ? error.message : String(error)
        }
      ]);
    }
  }
}
