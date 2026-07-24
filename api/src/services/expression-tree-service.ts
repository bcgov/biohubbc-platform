import { createHash } from 'node:crypto';
import { IDBConnection } from '../database/db';
import { ApiGeneralError } from '../errors/api-error';
import type { Expression } from '../models/expression';
import type { ExpressionClause } from '../models/expression-clause';
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

interface ReconstructExpressionTreeContext {
  expressionsById: Map<string, Expression>;
  clausesByExpressionId: Map<string, ExpressionClause[]>;
  predicatesById: Map<string, ReadPredicateNodeRow>;
}

interface ReconstructHydrationContext {
  expressionsById: Map<string, Expression>;
  clausesByExpressionId: Map<string, ExpressionClause[]>;
  predicateIds: Set<string>;
}

/**
 * Service for writing and reading reusable expression trees.
 *
 * Expression trees are authored as API payloads, but persistence stores them as
 * immutable, reusable graph fragments:
 * - `predicate` rows identify a single normalized predicate by semantic hash.
 * - typed predicate payload tables store the value/operator details.
 * - `expression` rows identify a logical AND/OR node by semantic hash.
 * - `expression_clause` rows preserve ordered parent-child structure.
 *
 * Core responsibilities:
 * 1. Normalize and hash expression/predicate nodes deterministically.
 * 2. Reuse existing anchors by hash when possible (dedupe by semantic identity).
 * 3. Insert missing expression/predicate anchors and clause edges when needed.
 * 4. Reconstruct a stored expression tree back into API shape.
 *
 * Important design detail:
 * Hashes are semantic, not positional row IDs. Two separately submitted trees
 * that mean the same thing should resolve to the same stored anchors. This is
 * why hashing is deliberately type-aware: case-insensitive string predicates,
 * split timestamp parts, object key order, and expression clause order are all
 * normalized before hashing.
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
   * Public callers pass an API-shaped expression tree. This method first lets
   * the semantic validator resolve property metadata and build typed internal
   * predicates, then the write path hashes and persists that normalized tree.
   *
   * Flow:
   * 1. Validate metadata and normalize predicate values.
   * 2. Compute deterministic hashes for all nodes in the tree.
   * 3. Load existing expression/predicate ids by those hashes in bulk.
   * 4. Resolve recursively, inserting only missing anchors/clauses.
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
   * Compute the semantic hash of a normalized expression tree, without persisting anything.
   *
   * Exposes the same hashing the write path uses, so two callers that mean the same search agree on
   * one identity: clause key order is irrelevant, case-insensitive predicates are folded, and typed
   * values are normalized. Martin sessions use this to recognise a repeated search and reuse its
   * authorization context, which is what makes anonymous tile caching effective.
   *
   * Pass a tree that has already been through
   * `ExpressionPredicateSemanticValidator.validateExpressionTree`, so the value normalization has
   * been applied — hashing a raw API tree would produce a different, unstable identity.
   *
   * @param {NormalizedExpressionTreeExpression} normalizedTree - Validated, normalized tree.
   * @return {string} Deterministic SHA-256 hex hash.
   * @memberof ExpressionTreeService
   */
  computeExpressionTreeHash(normalizedTree: NormalizedExpressionTreeExpression): string {
    return this.buildHashedTreeFromExpression(normalizedTree).hash;
  }

  /**
   * Read a stored expression tree by root expression id.
   *
   * Storage is normalized across several tables, but callers should receive the
   * original public tree shape: expression nodes with ordered clauses and
   * predicate leaves with scalar values.
   *
   * @param {string} expressionId - Root expression identifier.
   * @return {Promise<ExpressionTree>} Reconstructed API tree.
   * @memberof ExpressionTreeService
   */
  async readExpressionTree(expressionId: string): Promise<ExpressionTree> {
    return this.reconstructExpressionTreeFromStorage(expressionId, new Set<string>());
  }

  /**
   * Reconstruct an expression node from storage rows.
   *
   * Read reconstruction first hydrates the persisted graph from the root
   * expression anchor through its ordered `expression_clause` links, batching
   * expression and clause reads by tree level. Predicate links are hydrated once
   * after all reachable clauses are known. The final API tree is then assembled
   * from in-memory maps.
   *
   * This routine:
   * 1. Loads expression anchors and ordered clause links in batches.
   * 2. Hydrates all predicate leaves in one read.
   * 3. Guards against cycles during in-memory assembly.
   * 4. Re-enters recursively for child expression clauses without more DB I/O.
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
    const expressionsById = new Map<string, Expression>();
    const clausesByExpressionId = new Map<string, ExpressionClause[]>();
    const predicateIds = new Set<string>();
    let pendingExpressionIds = [expressionId];

    while (pendingExpressionIds.length > 0) {
      const expressionIdsToRead = [...new Set(pendingExpressionIds)].filter((id) => !expressionsById.has(id));
      pendingExpressionIds = [];

      if (expressionIdsToRead.length === 0) {
        continue;
      }

      pendingExpressionIds = await this.hydrateExpressionTreeStorageBatch(expressionIdsToRead, {
        expressionsById,
        clausesByExpressionId,
        predicateIds
      });
    }

    const readPredicates = await this.predicateRepository.readPredicateNodes([...predicateIds]);
    const predicatesById = new Map(readPredicates.map((row) => [row.predicate_id, row]));

    return this.buildExpressionTreeFromStorage(expressionId, visitedExpressionIds, {
      expressionsById,
      clausesByExpressionId,
      predicatesById
    });
  }

  /**
   * Hydrate one breadth-first batch of expression and clause rows.
   *
   * @private
   * @param {string[]} expressionIdsToRead - Expression ids in the current read batch.
   * @param {ReconstructHydrationContext} context - Mutable reconstruction maps.
   * @return {Promise<string[]>} Child expression ids that still need hydration.
   * @memberof ExpressionTreeService
   */
  private async hydrateExpressionTreeStorageBatch(
    expressionIdsToRead: string[],
    context: ReconstructHydrationContext
  ): Promise<string[]> {
    const [expressions, clauses] = await Promise.all([
      this.expressionRepository.getExpressionsByIds(expressionIdsToRead),
      this.expressionClauseRepository.getExpressionClausesByExpressionIds(expressionIdsToRead)
    ]);

    for (const expression of expressions) {
      context.expressionsById.set(expression.expression_id, expression);
      context.clausesByExpressionId.set(expression.expression_id, []);
    }

    return this.recordHydratedExpressionClauses(clauses, context);
  }

  /**
   * Record hydrated clause rows and collect unresolved child expression ids.
   *
   * @private
   * @param {ExpressionClause[]} clauses - Clause rows from the current read batch.
   * @param {ReconstructHydrationContext} context - Mutable reconstruction maps.
   * @return {string[]} Child expression ids that still need hydration.
   * @memberof ExpressionTreeService
   */
  private recordHydratedExpressionClauses(clauses: ExpressionClause[], context: ReconstructHydrationContext): string[] {
    const pendingExpressionIds: string[] = [];

    for (const clause of clauses) {
      this.recordHydratedExpressionClause(clause, context, pendingExpressionIds);
    }

    return pendingExpressionIds;
  }

  /**
   * Record one hydrated clause row.
   *
   * @private
   * @param {ExpressionClause} clause - Clause row from storage.
   * @param {ReconstructHydrationContext} context - Mutable reconstruction maps.
   * @param {string[]} pendingExpressionIds - Child expression ids queued for hydration.
   * @memberof ExpressionTreeService
   */
  private recordHydratedExpressionClause(
    clause: ExpressionClause,
    context: ReconstructHydrationContext,
    pendingExpressionIds: string[]
  ): void {
    const expressionClauses = context.clausesByExpressionId.get(clause.expression_id) ?? [];
    expressionClauses.push(clause);
    context.clausesByExpressionId.set(clause.expression_id, expressionClauses);

    if (clause.predicate_id) {
      context.predicateIds.add(clause.predicate_id);
      return;
    }

    if (!clause.child_expression_id) {
      throw new ApiGeneralError('Invalid expression clause target', [
        'ExpressionTreeService->reconstructExpressionTreeFromStorage',
        `expressionClauseId=${clause.expression_clause_id}`
      ]);
    }

    if (!context.expressionsById.has(clause.child_expression_id)) {
      pendingExpressionIds.push(clause.child_expression_id);
    }
  }

  /**
   * Build an API expression tree from already-hydrated storage rows.
   *
   * @private
   * @param {string} currentExpressionId - Expression id to build.
   * @param {Set<string>} currentVisitedExpressionIds - Path-local set used for cycle detection.
   * @param {ReconstructExpressionTreeContext} context - Hydrated storage rows keyed by id.
   * @return {ExpressionTreeExpression} Reconstructed expression node.
   * @memberof ExpressionTreeService
   */
  private buildExpressionTreeFromStorage(
    currentExpressionId: string,
    currentVisitedExpressionIds: Set<string>,
    context: ReconstructExpressionTreeContext
  ): ExpressionTreeExpression {
    if (currentVisitedExpressionIds.has(currentExpressionId)) {
      throw new ApiGeneralError('Cycle detected in expression tree', [
        'ExpressionTreeService->reconstructExpressionTreeFromStorage',
        `expressionId=${currentExpressionId}`
      ]);
    }

    const expression = context.expressionsById.get(currentExpressionId);

    if (!expression) {
      throw new ApiGeneralError('Missing expression row while reconstructing expression tree', [
        'ExpressionTreeService->reconstructExpressionTreeFromStorage',
        `expressionId=${currentExpressionId}`
      ]);
    }

    const links = context.clausesByExpressionId.get(currentExpressionId) ?? [];

    if (links.length === 0) {
      throw new ApiGeneralError('Expression has no active clauses', [
        'ExpressionTreeService->reconstructExpressionTreeFromStorage',
        `expressionId=${currentExpressionId}`
      ]);
    }

    const nextVisitedExpressionIds = new Set(currentVisitedExpressionIds);
    nextVisitedExpressionIds.add(currentExpressionId);
    const readClauses: ReadExpressionClause[] = [];

    for (const link of links) {
      if (link.predicate_id) {
        const predicateRow = context.predicatesById.get(link.predicate_id);

        if (!predicateRow) {
          throw new ApiGeneralError('Missing predicate row while reconstructing expression tree', [
            'ExpressionTreeService->reconstructExpressionTreeFromStorage',
            `predicateId=${link.predicate_id}`,
            `expressionId=${currentExpressionId}`
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
        clause: this.buildExpressionTreeFromStorage(link.child_expression_id, nextVisitedExpressionIds, context)
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
   * Geometry predicates can contain object values. JSON object key order should
   * not affect predicate identity, so object keys are sorted recursively before
   * hashing. Arrays intentionally keep their order because coordinate order and
   * collection order can be meaningful.
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
      const entries = Object.entries(value).toSorted(([a], [b]) => a.localeCompare(b));
      const serializedEntries = entries.map(([key, val]) => JSON.stringify(key) + ':' + this.stableStringify(val));
      return '{' + serializedEntries.join(',') + '}';
    }

    return JSON.stringify(value);
  }

  /**
   * Compute a SHA-256 hex digest for a normalized identity string.
   *
   * The input string is expected to already be canonical. This method only
   * turns that canonical identity into the fixed-width hash stored on anchor
   * rows and used for dedupe lookups.
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
   * Uses NFKC normalization and lower-casing so equivalent Unicode forms and
   * case variants collapse to the same semantic identity for operators whose
   * comparison semantics are case-insensitive.
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
   * This mirrors query semantics. `ILike` should dedupe values that differ only
   * by case, while `Like`, `Equals`, and the prefix/suffix operators preserve
   * case in their identity.
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
   * The semantic validator guarantees a non-Exists string predicate has a
   * string value. The `undefined` branch is kept for Exists predicates, which
   * intentionally have no value but still need a stable hash identity.
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
   * Boolean values are serialized explicitly instead of relying on generic JSON
   * stringification so Exists predicates can use the same empty-marker pattern
   * as other value-bearing predicate types.
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
   * This identity text is the contract for predicate dedupe. It includes:
   * - the shared property id (`fp`)
   * - the optional feature-type-property scope (`ftp`)
   * - the resolved property type id (`fpt`)
   * - the operator
   * - type-specific normalized value fields
   *
   * Empty strings are used for absent optional fields so `Exists` predicates and
   * nullable feature-type scopes produce stable, explicit identities.
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
   * The input is a semantically validated predicate, so this method should not
   * perform public API validation. It only converts the internal typed predicate
   * into a stable identity string whose fields match the predicate's runtime
   * comparison semantics.
   *
   * Canonicalization is type-aware:
   * - string: supports case-insensitive normalization for ILike.
   * - number: normalized through JS number stringify.
   * - boolean: normalized to explicit `true`/`false` text.
   * - timestamp: parsed into date/time parts to match DB storage/search.
   * - taxon/code: normalized as scalar ids.
   * - geometry/object-like values: stabilized via sorted-key stringify.
   * - Exists predicates: serialized with empty value markers.
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
      case 'timestamp': {
        // `undefined` is expected for timestamp Exists predicates. Exists means
        // "there is a timestamp value row" and therefore has no comparison
        // literal. Hash it with explicit empty date/time markers so it is
        // distinct from every date/time comparison but stable across requests.
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

        return this.buildPredicateIdentity(
          feature_property_id,
          feature_type_property_id,
          feature_property_type_id,
          predicate.operator,
          {
            date: predicate.value.date_value ?? '',
            time: predicate.value.time_value ?? ''
          }
        );
      }
      case 'taxon':
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
   * Clauses are represented as ordered hash references rather than embedding
   * full child payloads. This keeps parent identity compact and lets child
   * predicates/expressions be reused independently.
   *
   * Sequence is part of the identity because expression trees are authored as
   * ordered arrays and reconstruction preserves that order. Reordering clauses
   * therefore creates a different expression anchor.
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
   * This is a bottom-up transform for expressions: child predicates and child
   * expressions receive hashes first, then the parent expression hashes a list
   * of ordered child hash references.
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
   * The result sets intentionally de-duplicate repeated predicates/expressions
   * within the submitted tree before the repositories are queried.
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
   * The returned maps are mutable caches; recursive resolution adds newly
   * inserted ids to the same maps so duplicate nodes encountered later in the
   * same request are reused immediately.
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
   * Predicate anchors and payload rows are split intentionally. The anchor is
   * keyed by semantic hash and can be reused; the typed payload table is written
   * only when the anchor is first inserted.
   *
   * Reuse flow:
   * 1. Reuse preloaded id when present.
   * 2. Insert anchor by hash.
   * 3. Write typed payload row for the new anchor.
   *
   * Concurrent duplicate writes are guarded by the active predicate-hash
   * uniqueness constraint.
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
   * Child predicates/expressions must be resolved before the parent expression
   * can write its `expression_clause` rows, because those rows reference child
   * ids rather than hashes.
   *
   * Steps:
   * 1. Reuse existing anchor when hash is already known.
   * 2. Resolve child clauses (predicate ids / child expression ids).
   * 3. Insert expression anchor by hash.
   * 4. Insert clause edges for the new anchor.
   *
   * Concurrent duplicate writes are guarded by the active expression-hash
   * uniqueness constraint.
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
   * The predicate repository returns JSON projected from the active typed
   * predicate payload table. This method is the final boundary before returning
   * data to callers, so it enforces that exactly one payload table matched and
   * that the projected JSON still conforms to the public predicate schema.
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
