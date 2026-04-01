import { createHash } from 'crypto';
import { IDBConnection } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import {
  ExpressionTree,
  ExpressionTreeClause,
  ExpressionTreeExpression,
  ExpressionTreePredicate,
  TypedPredicate
} from '../models/expression-tree';
import {
  ExpressionHashClause,
  ExpressionTreeClauseWithHash,
  ExpressionTreeExpressionWithHash,
  ExpressionTreePredicateWithHash,
  ReadExpressionClause,
  WriteExpressionClause
} from '../models/expression-tree-internal';
import { FEATURE_PROPERTY_TYPE } from '../models/feature-property';
import { LogicalOperator } from '../models/logical-operator';
import { PredicateFeaturePropertyTypeName, ReadPredicateNodeRow } from '../models/predicate';
import { ExpressionClauseRepository } from '../repositories/expression-clause-repository';
import { ExpressionRepository } from '../repositories/expression-repository';
import { PredicateRepository } from '../repositories/predicate-repository';
import { PolicyStatementConditionExpressionService } from './access-policy/policy-statement-condition-expression-service';
import { PolicyStatementExpressionService } from './access-policy/policy-statement-expression-service';
import { DBService } from './db-service';
import { DownloadExpressionService } from './download/download-expression-service';
import { SecurityRuleExpressionService } from './security-rule-expression-service';

const predicateTypeMap: Record<TypedPredicate['type'], PredicateFeaturePropertyTypeName> = {
  string: FEATURE_PROPERTY_TYPE.STRING,
  number: FEATURE_PROPERTY_TYPE.NUMBER,
  boolean: FEATURE_PROPERTY_TYPE.BOOLEAN,
  timestamp: FEATURE_PROPERTY_TYPE.DATETIME,
  taxon: FEATURE_PROPERTY_TYPE.TAXON,
  geometry: FEATURE_PROPERTY_TYPE.SPATIAL,
  code: FEATURE_PROPERTY_TYPE.CODE
};

export class ExpressionTreeService extends DBService {
  expressionRepository: ExpressionRepository;
  expressionClauseRepository: ExpressionClauseRepository;
  predicateRepository: PredicateRepository;
  downloadExpressionService: DownloadExpressionService;
  policyStatementConditionExpressionService: PolicyStatementConditionExpressionService;
  policyStatementExpressionService: PolicyStatementExpressionService;
  securityRuleExpressionService: SecurityRuleExpressionService;

  constructor(connection: IDBConnection) {
    super(connection);
    this.expressionRepository = new ExpressionRepository(connection);
    this.expressionClauseRepository = new ExpressionClauseRepository(connection);
    this.predicateRepository = new PredicateRepository(connection);
    this.downloadExpressionService = new DownloadExpressionService(connection);
    this.policyStatementConditionExpressionService = new PolicyStatementConditionExpressionService(connection);
    this.policyStatementExpressionService = new PolicyStatementExpressionService(connection);
    this.securityRuleExpressionService = new SecurityRuleExpressionService(connection);
  }

  async writeExpressionTree(tree: ExpressionTree): Promise<{ expression_id: string }> {
    const hashedTree = this.buildHashedTreeFromExpression(tree);
    const { predicateIdsByHash, expressionIdsByHash } = await this.loadExistingIdsByHash(hashedTree);
    const expressionId = await this.resolveExpressionNode(hashedTree, predicateIdsByHash, expressionIdsByHash);
    return { expression_id: expressionId };
  }

  private async replaceOwnerExpressionTree(
    tree: ExpressionTree,
    replaceOwnerLink: (expressionId: string) => Promise<unknown>
  ): Promise<{ expression_id: string }> {
    const { expression_id } = await this.writeExpressionTree(tree);
    await replaceOwnerLink(expression_id);
    return { expression_id };
  }

  async replaceDownloadExpressionTree(downloadId: string, tree: ExpressionTree): Promise<{ expression_id: string }> {
    return this.replaceOwnerExpressionTree(tree, (expressionId) =>
      this.downloadExpressionService.replaceDownloadExpression(downloadId, expressionId)
    );
  }

  async replacePolicyStatementConditionExpressionTree(
    policyStatementConditionId: string,
    tree: ExpressionTree
  ): Promise<{ expression_id: string }> {
    return this.replaceOwnerExpressionTree(tree, (expressionId) =>
      this.policyStatementConditionExpressionService.replacePolicyStatementConditionExpression(
        policyStatementConditionId,
        expressionId
      )
    );
  }

  async replacePolicyStatementExpressionTree(
    policyStatementId: string,
    tree: ExpressionTree
  ): Promise<{ expression_id: string }> {
    return this.replaceOwnerExpressionTree(tree, (expressionId) =>
      this.policyStatementExpressionService.replacePolicyStatementExpression(policyStatementId, expressionId)
    );
  }

  async replaceSecurityRuleExpressionTree(
    securityRuleId: number,
    tree: ExpressionTree
  ): Promise<{ expression_id: string }> {
    return this.replaceOwnerExpressionTree(tree, (expressionId) =>
      this.securityRuleExpressionService.replaceSecurityRuleExpression(securityRuleId, expressionId)
    );
  }

  async readExpressionTree(expressionId: string): Promise<ExpressionTree> {
    return this.reconstructExpressionTreeFromStorage(expressionId, new Set<string>());
  }

  private async reconstructExpressionTreeFromStorage(
    expressionId: string,
    visitedExpressionIds: Set<string>
  ): Promise<ExpressionTreeExpression> {
    if (visitedExpressionIds.has(expressionId)) {
      throw new ApiExecuteSQLError('Cycle detected in expression tree', [
        'ExpressionTreeService->reconstructExpressionTreeFromStorage',
        `expressionId=${expressionId}`
      ]);
    }

    const nextVisitedExpressionIds = new Set(visitedExpressionIds);
    nextVisitedExpressionIds.add(expressionId);

    const expression = await this.expressionRepository.getExpressionById(expressionId);

    const links = await this.expressionClauseRepository.getExpressionClausesByExpressionId(expressionId);

    if (links.length === 0) {
      throw new ApiExecuteSQLError('Expression has no active clauses', [
        'ExpressionTreeService->reconstructExpressionTreeFromStorage',
        `expressionId=${expressionId}`
      ]);
    }

    const predicateIds = links.map((link) => link.predicate_id).filter((value): value is string => !!value);

    const readPredicates = await this.predicateRepository.readPredicateNodes(predicateIds);
    const predicatesById = new Map(readPredicates.map((row) => [row.predicate_id, row]));

    const readClauses: ReadExpressionClause[] = [];

    for (const link of links) {
      if (link.predicate_id) {
        const predicateRow = predicatesById.get(link.predicate_id);

        if (!predicateRow) {
          throw new ApiExecuteSQLError('Missing predicate row while reconstructing expression tree', [
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
        throw new ApiExecuteSQLError('Invalid expression clause target', [
          'ExpressionTreeService->reconstructExpressionTreeFromStorage',
          `expressionClauseId=${link.expression_clause_id}`
        ]);
      }

      readClauses.push({
        sequence: link.sequence,
        clause: await this.reconstructExpressionTreeFromStorage(link.child_expression_id, nextVisitedExpressionIds)
      });
    }

    return {
      type: 'expression',
      operator: expression.operator,
      clauses: readClauses.sort((a, b) => a.sequence - b.sequence).map((entry) => entry.clause)
    };
  }

  private stableStringify(value: unknown): string {
    if (value === null) {
      return 'null';
    }

    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    }

    if (typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
      return `{${entries.map(([key, val]) => `${JSON.stringify(key)}:${this.stableStringify(val)}`).join(',')}}`;
    }

    return JSON.stringify(value);
  }

  private computeHash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private normalizeCaseInsensitiveText(value: string): string {
    return value.normalize('NFKC').toLowerCase();
  }

  private isCaseInsensitiveStringOperator(operator: Extract<TypedPredicate, { type: 'string' }>['operator']): boolean {
    return operator === 'ILike';
  }

  private buildNormalizedPredicateIdentityForHash(
    clause: Extract<ExpressionTreeClause, { type: 'predicate' }>
  ): string {
    const { feature_type_property_id, predicate } = clause;

    switch (predicate.type) {
      case 'string': {
        let normalizedStringValue = '';

        if (predicate.value !== undefined) {
          if (this.isCaseInsensitiveStringOperator(predicate.operator)) {
            normalizedStringValue = this.normalizeCaseInsensitiveText(predicate.value);
          } else {
            normalizedStringValue = predicate.value.normalize('NFKC');
          }
        }

        return `predicate|string|ftp=${feature_type_property_id}|op=${predicate.operator}|value=${normalizedStringValue}`;
      }
      case 'number':
        return `predicate|number|ftp=${feature_type_property_id}|op=${predicate.operator}|value=${
          predicate.value === undefined ? '' : Number(predicate.value).toString()
        }`;
      case 'boolean':
        return `predicate|boolean|ftp=${feature_type_property_id}|op=${predicate.operator}|value=${
          predicate.value === undefined ? '' : predicate.value ? 'true' : 'false'
        }`;
      case 'timestamp':
        return `predicate|timestamp|ftp=${feature_type_property_id}|op=${predicate.operator}|date=${
          predicate.value?.date_value ?? ''
        }|time=${predicate.value?.time_value ?? ''}`;
      case 'taxon':
        return `predicate|taxon|ftp=${feature_type_property_id}|op=${predicate.operator}|value=${
          predicate.value ?? ''
        }`;
      case 'geometry':
        return `predicate|geometry|ftp=${feature_type_property_id}|op=${predicate.operator}|value=${
          predicate.value === undefined ? '' : this.stableStringify(predicate.value)
        }`;
      case 'code':
        return `predicate|code|ftp=${feature_type_property_id}|op=${predicate.operator}|value=${predicate.value ?? ''}`;
      default: {
        const exhaustiveType: never = predicate;
        throw new ApiExecuteSQLError('Unsupported predicate type for normalization', [
          'ExpressionTreeService->buildNormalizedPredicateIdentityForHash',
          { exhaustiveType }
        ]);
      }
    }
  }

  private buildNormalizedExpressionIdentityForHash(operator: LogicalOperator, clauses: ExpressionHashClause[]): string {
    return this.stableStringify({
      type: 'expression',
      operator,
      clauses
    });
  }

  private buildHashedTreeFromExpression(expression: ExpressionTreeExpression): ExpressionTreeExpressionWithHash {
    const hashedClauses: ExpressionTreeClauseWithHash[] = expression.clauses.map(
      (clause): ExpressionTreeClauseWithHash => {
        if (clause.type === 'predicate') {
          const hash = this.computeHash(this.buildNormalizedPredicateIdentityForHash(clause));
          return {
            ...clause,
            hash
          };
        }

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

  private async loadExistingIdsByHash(
    root: ExpressionTreeExpressionWithHash
  ): Promise<{ predicateIdsByHash: Map<string, string>; expressionIdsByHash: Map<string, string> }> {
    const predicateHashes = new Set<string>();
    const expressionHashes = new Set<string>();
    this.collectTreeHashes(root, predicateHashes, expressionHashes);

    const [existingPredicates, existingExpressions] = await Promise.all([
      this.predicateRepository.getPredicatesByHashes([...predicateHashes]),
      this.expressionRepository.getExpressionsByHashes([...expressionHashes])
    ]);

    return {
      predicateIdsByHash: new Map(existingPredicates.map((row) => [row.predicate_hash, row.predicate_id])),
      expressionIdsByHash: new Map(existingExpressions.map((row) => [row.expression_hash, row.expression_id]))
    };
  }

  private async resolvePredicateNode(
    clause: ExpressionTreePredicateWithHash,
    predicateIdsByHash: Map<string, string>
  ): Promise<string> {
    const existingPredicateId = predicateIdsByHash.get(clause.hash);
    if (existingPredicateId) {
      return existingPredicateId;
    }

    const insertedPredicate = await this.predicateRepository.insertPredicateAnchor({
      feature_type_property_id: clause.feature_type_property_id,
      feature_property_type_name: predicateTypeMap[clause.predicate.type],
      predicate_hash: clause.hash
    });

    if (insertedPredicate) {
      await this.predicateRepository.writePredicatePayload(insertedPredicate.predicate_id, clause.predicate);
      predicateIdsByHash.set(clause.hash, insertedPredicate.predicate_id);
      return insertedPredicate.predicate_id;
    }

    const existingPredicate = await this.predicateRepository.getPredicateByHash(clause.hash);
    if (!existingPredicate) {
      throw new ApiExecuteSQLError('Failed to resolve predicate anchor', [
        'ExpressionTreeService->resolvePredicateNode',
        `predicateHash=${clause.hash}`
      ]);
    }

    predicateIdsByHash.set(clause.hash, existingPredicate.predicate_id);
    return existingPredicate.predicate_id;
  }

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

      const childExpressionId = await this.resolveExpressionNode(clause, predicateIdsByHash, expressionIdsByHash);
      resolvedClauses.push({
        sequence: index + 1,
        predicate_id: null,
        child_expression_id: childExpressionId
      });
    }

    const insertedExpression = await this.expressionRepository.insertExpressionAnchor(
      expression.operator,
      expression.hash
    );
    const resolvedExpression =
      insertedExpression ?? (await this.expressionRepository.getExpressionByHash(expression.hash));

    if (!resolvedExpression) {
      throw new ApiExecuteSQLError('Failed to resolve expression anchor', [
        'ExpressionTreeService->resolveExpressionNode',
        `expressionHash=${expression.hash}`
      ]);
    }

    expressionIdsByHash.set(expression.hash, resolvedExpression.expression_id);

    if (insertedExpression) {
      await this.expressionClauseRepository.insertExpressionClauses(
        resolvedClauses.map((clause) => ({
          expression_id: resolvedExpression.expression_id,
          ...clause
        }))
      );
    }

    return resolvedExpression.expression_id;
  }

  private parseReadPredicateRow(row: ReadPredicateNodeRow, predicateId: string): ExpressionTreePredicate {
    if (row.payload_count !== 1 || !row.predicate_node) {
      throw new ApiExecuteSQLError('Invalid predicate payload integrity', [
        'ExpressionTreeService->parseReadPredicateRow',
        { predicateId, payload_count: row.payload_count }
      ]);
    }

    try {
      return ExpressionTreePredicate.parse(row.predicate_node);
    } catch (error) {
      throw new ApiExecuteSQLError('Invalid read predicate node shape', [
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
