import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { getMockDBConnection } from '../__mocks__/db';
import { ApiGeneralError } from '../errors/api-error';
import { Expression, ResolvedExpressionAnchor } from '../models/expression';
import { ExpressionClause } from '../models/expression-clause';
import { ExpressionTree, ExpressionTreeClause, ExpressionTreePredicate } from '../models/expression-tree';
import {
  NormalizedExpressionTree,
  NormalizedExpressionTreeClause,
  NormalizedExpressionTreePredicate
} from '../models/expression-tree-internal';
import { Predicate, ReadPredicateNodeRow, ResolvedPredicateAnchor } from '../models/predicate';
import { ExpressionClauseRepository } from '../repositories/expression-clause-repository';
import { ExpressionRepository } from '../repositories/expression-repository';
import { PredicateRepository } from '../repositories/predicate-repository';
import { parseTimestamp } from '../utils/timestamp';
import { ExpressionTreeNormalizationService } from './expression-tree-normalization-service';
import { ExpressionTreeService } from './expression-tree-service';

const normalizePredicateForTest = (predicate: ExpressionTreePredicate): NormalizedExpressionTreePredicate => {
  if (['Before', 'After', 'OnDate', 'OnTime'].includes(predicate.operator)) {
    const timestampValue =
      typeof predicate.value === 'string' ? parseTimestamp(predicate.value) ?? undefined : undefined;

    return {
      ...predicate,
      feature_property_type_id: 4,
      feature_property_type_name: 'datetime',
      internal_predicate: {
        type: 'timestamp',
        operator: predicate.operator,
        value: timestampValue
      }
    };
  }

  if (typeof predicate.value === 'number') {
    return {
      ...predicate,
      feature_property_type_id: 2,
      feature_property_type_name: 'number',
      internal_predicate: {
        type: 'number',
        operator: predicate.operator,
        value: predicate.value
      }
    };
  }

  if (typeof predicate.value === 'boolean') {
    return {
      ...predicate,
      feature_property_type_id: 3,
      feature_property_type_name: 'boolean',
      internal_predicate: {
        type: 'boolean',
        operator: predicate.operator,
        value: predicate.value
      }
    };
  }

  return {
    ...predicate,
    feature_property_type_id: 1,
    feature_property_type_name: 'string',
    internal_predicate: {
      type: 'string',
      operator: predicate.operator,
      value: typeof predicate.value === 'string' ? predicate.value : undefined
    }
  };
};

const normalizeClauseForTest = (clause: ExpressionTreeClause): NormalizedExpressionTreeClause => {
  if (clause.type === 'expression') {
    return {
      ...clause,
      clauses: clause.clauses.map(normalizeClauseForTest)
    };
  }

  return normalizePredicateForTest(clause);
};

const normalizeExpressionStructureForTest = (tree: ExpressionTree): ExpressionTree => {
  const clauses = tree.clauses.flatMap((clause) => {
    if (clause.type === 'predicate') {
      return [clause];
    }

    const expression = normalizeExpressionStructureForTest(clause);
    return expression.operator === tree.operator ? expression.clauses : [expression];
  });

  clauses.sort((left, right) =>
    JSON.stringify(left).localeCompare(JSON.stringify(right), undefined, { numeric: true })
  );

  return { ...tree, clauses };
};

const normalizeExpressionTreeForTest = (tree: ExpressionTree): NormalizedExpressionTree => {
  const expression = normalizeExpressionStructureForTest(tree);
  return { ...expression, clauses: expression.clauses.map(normalizeClauseForTest) };
};

describe('ExpressionTreeService', () => {
  beforeEach(() => {
    sinon
      .stub(ExpressionTreeNormalizationService.prototype, 'normalize')
      .callsFake(async (tree: ExpressionTree) => normalizeExpressionTreeForTest(tree));
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('writeExpressionTree', () => {
    it('writes expression_clause rows with predicate/child targets and expression operator', async () => {
      const service = new ExpressionTreeService(getMockDBConnection());

      sinon
        .stub(ExpressionRepository.prototype, 'insertExpressionAnchor')
        .onFirstCall()
        .resolves({
          expression_id: 'expr-2',
          operator: 'AND',
          expression_hash: 'expr-hash-2',
          inserted: true
        } as ResolvedExpressionAnchor)
        .onSecondCall()
        .resolves({
          expression_id: 'expr-1',
          operator: 'OR',
          expression_hash: 'expr-hash-1',
          inserted: true
        } as ResolvedExpressionAnchor);

      sinon
        .stub(PredicateRepository.prototype, 'insertPredicateAnchor')
        .onFirstCall()
        .resolves({
          predicate_id: 'pred-1',
          feature_property_id: 10,
          feature_type_property_id: 1,
          feature_property_type_id: 1,
          predicate_hash: 'p1',
          inserted: true
        } as ResolvedPredicateAnchor)
        .onSecondCall()
        .resolves({
          predicate_id: 'pred-2',
          feature_property_id: 20,
          feature_type_property_id: 2,
          feature_property_type_id: 2,
          predicate_hash: 'p2',
          inserted: true
        } as ResolvedPredicateAnchor);

      sinon.stub(PredicateRepository.prototype, 'getPredicatesByHashes').resolves([] as Predicate[]);
      sinon.stub(ExpressionRepository.prototype, 'getExpressionsByHashes').resolves([] as Expression[]);
      sinon.stub(PredicateRepository.prototype, 'writePredicatePayload').resolves();

      const insertExpressionClausesStub = sinon
        .stub(ExpressionClauseRepository.prototype, 'insertExpressionClauses')
        .resolves([] as ExpressionClause[]);

      await service.writeExpressionTree({
        type: 'expression',
        operator: 'OR',
        clauses: [
          {
            type: 'predicate',
            feature_property_id: 10,
            feature_type_property_id: 1,
            operator: 'Equals',
            value: 'elk'
          },
          {
            type: 'expression',
            operator: 'AND',
            clauses: [
              {
                type: 'predicate',
                feature_property_id: 20,
                feature_type_property_id: 2,
                operator: 'GreaterThan',
                value: 3
              }
            ]
          }
        ]
      });

      expect(insertExpressionClausesStub.callCount).to.equal(2);
      expect(insertExpressionClausesStub.firstCall.args[0]).to.eql([
        {
          expression_id: 'expr-2',
          sequence: 1,
          predicate_id: 'pred-1',
          child_expression_id: null
        }
      ]);
      expect(insertExpressionClausesStub.secondCall.args[0]).to.eql([
        {
          expression_id: 'expr-1',
          sequence: 1,
          predicate_id: null,
          child_expression_id: 'expr-2'
        },
        {
          expression_id: 'expr-1',
          sequence: 2,
          predicate_id: 'pred-2',
          child_expression_id: null
        }
      ]);
    });

    it('reuses existing predicate and expression anchors when hashes match', async () => {
      const service = new ExpressionTreeService(getMockDBConnection());

      const insertPredicateAnchorStub = sinon.stub(PredicateRepository.prototype, 'insertPredicateAnchor').resolves({
        predicate_id: 'pred-1',
        feature_property_id: 10,
        feature_type_property_id: 1,
        feature_property_type_id: 1,
        predicate_hash: 'p1',
        inserted: false
      } as ResolvedPredicateAnchor);
      const insertExpressionAnchorStub = sinon.stub(ExpressionRepository.prototype, 'insertExpressionAnchor').resolves({
        expression_id: 'expr-1',
        operator: 'AND',
        expression_hash: 'expr-hash-1',
        inserted: false
      } as ResolvedExpressionAnchor);
      sinon.stub(PredicateRepository.prototype, 'getPredicatesByHashes').callsFake(
        async ([predicateHash]) =>
          [
            {
              predicate_id: 'pred-1',
              feature_property_id: 10,
              feature_type_property_id: 1,
              feature_property_type_id: 1,
              predicate_hash: predicateHash
            }
          ] as Predicate[]
      );
      sinon
        .stub(ExpressionRepository.prototype, 'getExpressionsByHashes')
        .callsFake(
          async ([expressionHash]) =>
            [{ expression_id: 'expr-1', operator: 'AND', expression_hash: expressionHash }] as Expression[]
        );
      const writePredicatePayloadStub = sinon.stub(PredicateRepository.prototype, 'writePredicatePayload').resolves();

      const insertExpressionClausesStub = sinon
        .stub(ExpressionClauseRepository.prototype, 'insertExpressionClauses')
        .resolves([] as ExpressionClause[]);

      const result = await service.writeExpressionTree({
        type: 'expression',
        operator: 'AND',
        clauses: [
          {
            type: 'predicate',
            feature_property_id: 10,
            feature_type_property_id: 1,
            operator: 'Equals',
            value: 'elk'
          }
        ]
      });

      expect(result).to.eql({ expression_id: 'expr-1' });
      expect(insertPredicateAnchorStub.notCalled).to.equal(true);
      expect(insertExpressionAnchorStub.notCalled).to.equal(true);
      expect(writePredicatePayloadStub.notCalled).to.equal(true);
      expect(insertExpressionClausesStub.notCalled).to.equal(true);
    });

    it('persists predicates with nullable feature_type_property_id', async () => {
      const service = new ExpressionTreeService(getMockDBConnection());

      const insertPredicateStub = sinon.stub(PredicateRepository.prototype, 'insertPredicateAnchor').resolves({
        predicate_id: 'pred-1',
        feature_property_id: 10,
        feature_type_property_id: null,
        feature_property_type_id: 1,
        predicate_hash: 'p1',
        inserted: true
      } as ResolvedPredicateAnchor);
      sinon.stub(ExpressionRepository.prototype, 'insertExpressionAnchor').resolves({
        expression_id: 'expr-1',
        operator: 'AND',
        expression_hash: 'expr-hash-1',
        inserted: true
      } as ResolvedExpressionAnchor);
      sinon.stub(PredicateRepository.prototype, 'getPredicatesByHashes').resolves([] as Predicate[]);
      sinon.stub(ExpressionRepository.prototype, 'getExpressionsByHashes').resolves([] as Expression[]);
      sinon.stub(PredicateRepository.prototype, 'writePredicatePayload').resolves();
      sinon.stub(ExpressionClauseRepository.prototype, 'insertExpressionClauses').resolves([] as ExpressionClause[]);

      await service.writeExpressionTree({
        type: 'expression',
        operator: 'AND',
        clauses: [
          {
            type: 'predicate',
            feature_property_id: 10,
            feature_type_property_id: null,
            operator: 'Equals',
            value: 'elk'
          }
        ]
      });

      expect(insertPredicateStub.firstCall.args[0]).to.include({
        feature_property_id: 10,
        feature_type_property_id: null,
        feature_property_type_id: 1
      });
    });

    it('normalizes ILike values for case-insensitive dedupe', async () => {
      const service = new ExpressionTreeService(getMockDBConnection());

      const insertPredicateStub = sinon
        .stub(PredicateRepository.prototype, 'insertPredicateAnchor')
        .onFirstCall()
        .resolves({
          predicate_id: 'pred-1',
          feature_property_id: 10,
          feature_type_property_id: 1,
          feature_property_type_id: 1,
          predicate_hash: 'p1',
          inserted: true
        } as ResolvedPredicateAnchor)
        .onSecondCall()
        .resolves({
          predicate_id: 'pred-2',
          feature_property_id: 10,
          feature_type_property_id: 1,
          feature_property_type_id: 1,
          predicate_hash: 'p2',
          inserted: true
        } as ResolvedPredicateAnchor);

      sinon.stub(PredicateRepository.prototype, 'getPredicatesByHashes').resolves([] as Predicate[]);
      sinon.stub(ExpressionRepository.prototype, 'getExpressionsByHashes').resolves([] as Expression[]);
      sinon.stub(PredicateRepository.prototype, 'writePredicatePayload').resolves();
      sinon.stub(ExpressionRepository.prototype, 'insertExpressionAnchor').resolves({
        expression_id: 'expr-1',
        operator: 'AND',
        expression_hash: 'expr-hash-1',
        inserted: true
      } as ResolvedExpressionAnchor);
      sinon.stub(ExpressionClauseRepository.prototype, 'insertExpressionClauses').resolves([] as ExpressionClause[]);

      await service.writeExpressionTree({
        type: 'expression',
        operator: 'AND',
        clauses: [
          {
            type: 'predicate',
            feature_property_id: 10,
            feature_type_property_id: 1,
            operator: 'ILike',
            value: 'Wolf'
          },
          {
            type: 'predicate',
            feature_property_id: 10,
            feature_type_property_id: 1,
            operator: 'ILike',
            value: 'wOLF'
          }
        ]
      });

      expect(insertPredicateStub.callCount).to.equal(1);
    });

    it('reuses repeated child expression subtrees by hash within the same write', async () => {
      const service = new ExpressionTreeService(getMockDBConnection());

      const insertPredicateStub = sinon.stub(PredicateRepository.prototype, 'insertPredicateAnchor').resolves({
        predicate_id: 'pred-1',
        feature_property_id: 10,
        feature_type_property_id: 1,
        feature_property_type_id: 1,
        predicate_hash: 'pred-hash-1',
        inserted: true
      } as ResolvedPredicateAnchor);

      const writePredicatePayloadStub = sinon.stub(PredicateRepository.prototype, 'writePredicatePayload').resolves();

      const insertExpressionAnchorStub = sinon
        .stub(ExpressionRepository.prototype, 'insertExpressionAnchor')
        .onFirstCall()
        .resolves({
          expression_id: 'expr-child',
          operator: 'AND',
          expression_hash: 'child-hash',
          inserted: true
        } as ResolvedExpressionAnchor)
        .onSecondCall()
        .resolves({
          expression_id: 'expr-root',
          operator: 'OR',
          expression_hash: 'root-hash',
          inserted: true
        } as ResolvedExpressionAnchor);

      sinon.stub(PredicateRepository.prototype, 'getPredicatesByHashes').resolves([] as Predicate[]);
      sinon.stub(ExpressionRepository.prototype, 'getExpressionsByHashes').resolves([] as Expression[]);

      const insertExpressionClausesStub = sinon
        .stub(ExpressionClauseRepository.prototype, 'insertExpressionClauses')
        .resolves([] as ExpressionClause[]);

      const repeatedChild = {
        type: 'expression' as const,
        operator: 'AND' as const,
        clauses: [
          {
            type: 'predicate' as const,
            feature_property_id: 10,
            feature_type_property_id: 1,
            operator: 'Equals' as const,
            value: 'elk'
          }
        ]
      };

      const result = await service.writeExpressionTree({
        type: 'expression',
        operator: 'OR',
        clauses: [repeatedChild, repeatedChild]
      });

      expect(result).to.eql({ expression_id: 'expr-root' });
      expect(insertPredicateStub.callCount).to.equal(1);
      expect(writePredicatePayloadStub.callCount).to.equal(1);
      expect(insertExpressionAnchorStub.callCount).to.equal(2);
      expect(insertExpressionClausesStub.callCount).to.equal(2);
      expect(insertExpressionClausesStub.firstCall.args[0]).to.eql([
        {
          expression_id: 'expr-child',
          sequence: 1,
          predicate_id: 'pred-1',
          child_expression_id: null
        }
      ]);
      expect(insertExpressionClausesStub.secondCall.args[0]).to.eql([
        {
          expression_id: 'expr-root',
          sequence: 1,
          predicate_id: null,
          child_expression_id: 'expr-child'
        },
        {
          expression_id: 'expr-root',
          sequence: 2,
          predicate_id: null,
          child_expression_id: 'expr-child'
        }
      ]);
    });

    it('hashes timestamp predicates through normalized date and time parts', async () => {
      const service = new ExpressionTreeService(getMockDBConnection());

      const insertPredicateStub = sinon
        .stub(PredicateRepository.prototype, 'insertPredicateAnchor')
        .callsFake(async (payload) => ({
          predicate_id: `pred-${insertPredicateStub.callCount}`,
          feature_property_id: payload.feature_property_id,
          feature_type_property_id: payload.feature_type_property_id,
          feature_property_type_id: payload.feature_property_type_id,
          predicate_hash: payload.predicate_hash,
          inserted: true
        }));

      sinon.stub(PredicateRepository.prototype, 'getPredicatesByHashes').resolves([] as Predicate[]);
      sinon.stub(ExpressionRepository.prototype, 'getExpressionsByHashes').resolves([] as Expression[]);
      sinon.stub(PredicateRepository.prototype, 'writePredicatePayload').resolves();
      sinon.stub(ExpressionRepository.prototype, 'insertExpressionAnchor').resolves({
        expression_id: 'expr-1',
        operator: 'AND',
        expression_hash: 'expr-hash-1',
        inserted: true
      } as ResolvedExpressionAnchor);
      sinon.stub(ExpressionClauseRepository.prototype, 'insertExpressionClauses').resolves([] as ExpressionClause[]);

      await service.writeExpressionTree({
        type: 'expression',
        operator: 'AND',
        clauses: [
          {
            type: 'predicate',
            feature_property_id: 10,
            feature_type_property_id: 1,
            operator: 'After',
            value: '2024-01-01'
          },
          {
            type: 'predicate',
            feature_property_id: 10,
            feature_type_property_id: 1,
            operator: 'After',
            value: '2024-01-01'
          },
          {
            type: 'predicate',
            feature_property_id: 10,
            feature_type_property_id: 1,
            operator: 'After',
            value: '14:30:00-07:00'
          },
          {
            type: 'predicate',
            feature_property_id: 10,
            feature_type_property_id: 1,
            operator: 'After',
            value: '14:30:00-07:00'
          },
          {
            type: 'predicate',
            feature_property_id: 10,
            feature_type_property_id: 1,
            operator: 'After',
            value: '2024-01-01T14:30:00-07:00'
          },
          {
            type: 'predicate',
            feature_property_id: 10,
            feature_type_property_id: 1,
            operator: 'After',
            value: '2024-01-01T14:30:00-07:00'
          }
        ]
      });

      expect(insertPredicateStub.callCount).to.equal(3);
    });

    it('returns a new root expression id when authored tree semantics change', async () => {
      const service = new ExpressionTreeService(getMockDBConnection());

      sinon
        .stub(ExpressionRepository.prototype, 'insertExpressionAnchor')
        .onFirstCall()
        .resolves({
          expression_id: 'expr-1',
          operator: 'AND',
          expression_hash: 'expr-hash-1',
          inserted: true
        } as ResolvedExpressionAnchor)
        .onSecondCall()
        .resolves({
          expression_id: 'expr-2',
          operator: 'AND',
          expression_hash: 'expr-hash-2',
          inserted: true
        } as ResolvedExpressionAnchor);

      sinon
        .stub(PredicateRepository.prototype, 'insertPredicateAnchor')
        .onFirstCall()
        .resolves({
          predicate_id: 'pred-1',
          feature_property_id: 10,
          feature_type_property_id: 1,
          feature_property_type_id: 1,
          predicate_hash: 'p1',
          inserted: true
        } as ResolvedPredicateAnchor)
        .onSecondCall()
        .resolves({
          predicate_id: 'pred-2',
          feature_property_id: 10,
          feature_type_property_id: 1,
          feature_property_type_id: 1,
          predicate_hash: 'p2',
          inserted: true
        } as ResolvedPredicateAnchor);

      sinon.stub(PredicateRepository.prototype, 'getPredicatesByHashes').resolves([] as Predicate[]);
      sinon.stub(ExpressionRepository.prototype, 'getExpressionsByHashes').resolves([] as Expression[]);
      sinon.stub(PredicateRepository.prototype, 'writePredicatePayload').resolves();
      sinon.stub(ExpressionClauseRepository.prototype, 'insertExpressionClauses').resolves([] as ExpressionClause[]);

      const original = await service.writeExpressionTree({
        type: 'expression',
        operator: 'AND',
        clauses: [
          {
            type: 'predicate',
            feature_property_id: 10,
            feature_type_property_id: 1,
            operator: 'Equals',
            value: 'elk'
          }
        ]
      });

      const changed = await service.writeExpressionTree({
        type: 'expression',
        operator: 'AND',
        clauses: [
          {
            type: 'predicate',
            feature_property_id: 10,
            feature_type_property_id: 1,
            operator: 'Equals',
            value: 'wolf'
          }
        ]
      });

      expect(original.expression_id).to.equal('expr-1');
      expect(changed.expression_id).to.equal('expr-2');
    });
  });

  describe('readExpressionTree', () => {
    it('reconstructs nested tree using expression.operator and expression_clause sequence', async () => {
      const service = new ExpressionTreeService(getMockDBConnection());

      const getExpressionsByIdsStub = sinon.stub(ExpressionRepository.prototype, 'getExpressionsByIds');
      getExpressionsByIdsStub
        .onFirstCall()
        .resolves([{ expression_id: 'expr-1', operator: 'OR', expression_hash: 'expr-hash-1' } as Expression])
        .onSecondCall()
        .resolves([{ expression_id: 'expr-2', operator: 'AND', expression_hash: 'expr-hash-2' } as Expression]);

      const getExpressionClausesByExpressionIdsStub = sinon.stub(
        ExpressionClauseRepository.prototype,
        'getExpressionClausesByExpressionIds'
      );
      getExpressionClausesByExpressionIdsStub
        .onFirstCall()
        .resolves([
          {
            expression_clause_id: 'ec-1',
            expression_id: 'expr-1',
            sequence: 1,
            predicate_id: 'pred-1',
            child_expression_id: null
          },
          {
            expression_clause_id: 'ec-2',
            expression_id: 'expr-1',
            sequence: 2,
            predicate_id: null,
            child_expression_id: 'expr-2'
          }
        ] as ExpressionClause[])
        .onSecondCall()
        .resolves([
          {
            expression_clause_id: 'ec-3',
            expression_id: 'expr-2',
            sequence: 1,
            predicate_id: 'pred-2',
            child_expression_id: null
          }
        ] as ExpressionClause[]);

      const readPredicateNodesStub = sinon.stub(PredicateRepository.prototype, 'readPredicateNodes');
      readPredicateNodesStub.resolves([
        {
          predicate_id: 'pred-1',
          payload_count: 1,
          predicate_node: {
            type: 'predicate',
            feature_property_id: 70,
            feature_type_property_id: 7,
            operator: 'GreaterThan',
            value: 5
          }
        },
        {
          predicate_id: 'pred-2',
          payload_count: 1,
          predicate_node: {
            type: 'predicate',
            feature_property_id: 80,
            feature_type_property_id: 8,
            operator: 'Equals',
            value: true
          }
        }
      ] as ReadPredicateNodeRow[]);

      const result = await service.readExpressionTree('expr-1');

      expect(getExpressionsByIdsStub.firstCall.args).to.eql([['expr-1']]);
      expect(getExpressionsByIdsStub.secondCall.args).to.eql([['expr-2']]);
      expect(getExpressionClausesByExpressionIdsStub.firstCall.args).to.eql([['expr-1']]);
      expect(getExpressionClausesByExpressionIdsStub.secondCall.args).to.eql([['expr-2']]);
      expect(readPredicateNodesStub.callCount).to.equal(1);
      expect(readPredicateNodesStub.firstCall.args).to.eql([['pred-1', 'pred-2']]);
      expect(result).to.eql({
        type: 'expression',
        operator: 'OR',
        clauses: [
          {
            type: 'predicate',
            feature_property_id: 70,
            feature_type_property_id: 7,
            operator: 'GreaterThan',
            value: 5
          },
          {
            type: 'expression',
            operator: 'AND',
            clauses: [
              {
                type: 'predicate',
                feature_property_id: 80,
                feature_type_property_id: 8,
                operator: 'Equals',
                value: true
              }
            ]
          }
        ]
      });
    });

    it('throws when predicate payload integrity is invalid', async () => {
      const service = new ExpressionTreeService(getMockDBConnection());

      sinon
        .stub(ExpressionRepository.prototype, 'getExpressionsByIds')
        .resolves([{ expression_id: 'expr-1', operator: 'AND', expression_hash: 'expr-hash-1' } as Expression]);
      sinon.stub(ExpressionClauseRepository.prototype, 'getExpressionClausesByExpressionIds').resolves([
        {
          expression_clause_id: 'ec-1',
          expression_id: 'expr-1',
          sequence: 1,
          predicate_id: 'pred-1',
          child_expression_id: null
        }
      ] as ExpressionClause[]);
      sinon.stub(PredicateRepository.prototype, 'readPredicateNodes').resolves([
        {
          predicate_id: 'pred-1',
          payload_count: 2,
          predicate_node: null
        }
      ] as ReadPredicateNodeRow[]);

      try {
        await service.readExpressionTree('expr-1');
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiGeneralError);
      }
    });
  });
});
