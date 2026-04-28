import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { getMockDBConnection } from '../__mocks__/db';
import { ApiGeneralError } from '../errors/api-error';
import { Expression } from '../models/expression';
import { ExpressionClause } from '../models/expression-clause';
import { Predicate, ReadPredicateNodeRow, ResolvedPredicateAnchor } from '../models/predicate';
import { ExpressionClauseRepository } from '../repositories/expression-clause-repository';
import { ExpressionRepository, ResolvedExpressionAnchor } from '../repositories/expression-repository';
import { PredicateRepository } from '../repositories/predicate-repository';
import { ExpressionTreeService } from './expression-tree-service';

describe('ExpressionTreeService', () => {
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
          feature_type_property_id: 1,
          feature_property_type_id: 1,
          predicate_hash: 'p1',
          inserted: true
        } as ResolvedPredicateAnchor)
        .onSecondCall()
        .resolves({
          predicate_id: 'pred-2',
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
            feature_type_property_id: 1,
            predicate: { type: 'string', operator: 'Equals', value: 'elk' }
          },
          {
            type: 'expression',
            operator: 'AND',
            clauses: [
              {
                type: 'predicate',
                feature_type_property_id: 2,
                predicate: { type: 'number', operator: 'GreaterThan', value: 3 }
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
          predicate_id: 'pred-2',
          child_expression_id: null
        }
      ]);
      expect(insertExpressionClausesStub.secondCall.args[0]).to.eql([
        {
          expression_id: 'expr-1',
          sequence: 1,
          predicate_id: 'pred-1',
          child_expression_id: null
        },
        {
          expression_id: 'expr-1',
          sequence: 2,
          predicate_id: null,
          child_expression_id: 'expr-2'
        }
      ]);
    });

    it('reuses existing predicate and expression anchors when hashes match', async () => {
      const service = new ExpressionTreeService(getMockDBConnection());

      sinon.stub(PredicateRepository.prototype, 'insertPredicateAnchor').resolves({
        predicate_id: 'pred-1',
        feature_type_property_id: 1,
        feature_property_type_id: 1,
        predicate_hash: 'p1',
        inserted: false
      } as ResolvedPredicateAnchor);
      sinon.stub(ExpressionRepository.prototype, 'insertExpressionAnchor').resolves({
        expression_id: 'expr-1',
        operator: 'AND',
        expression_hash: 'expr-hash-1',
        inserted: false
      } as ResolvedExpressionAnchor);
      sinon.stub(PredicateRepository.prototype, 'getPredicatesByHashes').resolves([
        {
          predicate_id: 'pred-1',
          feature_type_property_id: 1,
          feature_property_type_id: 1,
          predicate_hash: 'p1'
        }
      ] as Predicate[]);
      sinon
        .stub(ExpressionRepository.prototype, 'getExpressionsByHashes')
        .resolves([{ expression_id: 'expr-1', operator: 'AND', expression_hash: 'expr-hash-1' }] as Expression[]);
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
            feature_type_property_id: 1,
            predicate: { type: 'string', operator: 'Equals', value: 'elk' }
          }
        ]
      });

      expect(result).to.eql({ expression_id: 'expr-1' });
      expect(writePredicatePayloadStub.notCalled).to.equal(true);
      expect(insertExpressionClausesStub.notCalled).to.equal(true);
    });

    it('normalizes ILike values for case-insensitive dedupe', async () => {
      const service = new ExpressionTreeService(getMockDBConnection());

      const insertPredicateStub = sinon
        .stub(PredicateRepository.prototype, 'insertPredicateAnchor')
        .onFirstCall()
        .resolves({
          predicate_id: 'pred-1',
          feature_type_property_id: 1,
          feature_property_type_id: 1,
          predicate_hash: 'p1',
          inserted: true
        } as ResolvedPredicateAnchor)
        .onSecondCall()
        .resolves({
          predicate_id: 'pred-2',
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
            feature_type_property_id: 1,
            predicate: { type: 'string', operator: 'ILike', value: 'Wolf' }
          },
          {
            type: 'predicate',
            feature_type_property_id: 1,
            predicate: { type: 'string', operator: 'ILike', value: 'wOLF' }
          }
        ]
      });

      expect(insertPredicateStub.callCount).to.equal(1);
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
          feature_type_property_id: 1,
          feature_property_type_id: 1,
          predicate_hash: 'p1',
          inserted: true
        } as ResolvedPredicateAnchor)
        .onSecondCall()
        .resolves({
          predicate_id: 'pred-2',
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
            feature_type_property_id: 1,
            predicate: { type: 'string', operator: 'Equals', value: 'elk' }
          }
        ]
      });

      const changed = await service.writeExpressionTree({
        type: 'expression',
        operator: 'AND',
        clauses: [
          {
            type: 'predicate',
            feature_type_property_id: 1,
            predicate: { type: 'string', operator: 'Equals', value: 'wolf' }
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

      const getExpressionByIdStub = sinon.stub(ExpressionRepository.prototype, 'getExpressionById');
      getExpressionByIdStub
        .onFirstCall()
        .resolves({ expression_id: 'expr-1', operator: 'OR', expression_hash: 'expr-hash-1' } as Expression)
        .onSecondCall()
        .resolves({ expression_id: 'expr-2', operator: 'AND', expression_hash: 'expr-hash-2' } as Expression);

      const getExpressionClausesByExpressionIdStub = sinon.stub(
        ExpressionClauseRepository.prototype,
        'getExpressionClausesByExpressionId'
      );
      getExpressionClausesByExpressionIdStub
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
      readPredicateNodesStub
        .onFirstCall()
        .resolves([
          {
            predicate_id: 'pred-1',
            payload_count: 1,
            predicate_node: {
              type: 'predicate',
              feature_type_property_id: 7,
              predicate: { type: 'number', operator: 'GreaterThan', value: 5 }
            }
          }
        ] as ReadPredicateNodeRow[])
        .onSecondCall()
        .resolves([
          {
            predicate_id: 'pred-2',
            payload_count: 1,
            predicate_node: {
              type: 'predicate',
              feature_type_property_id: 8,
              predicate: { type: 'boolean', operator: 'Equals', value: true }
            }
          }
        ] as ReadPredicateNodeRow[]);

      const result = await service.readExpressionTree('expr-1');

      expect(result).to.eql({
        type: 'expression',
        operator: 'OR',
        clauses: [
          {
            type: 'predicate',
            feature_type_property_id: 7,
            predicate: { type: 'number', operator: 'GreaterThan', value: 5 }
          },
          {
            type: 'expression',
            operator: 'AND',
            clauses: [
              {
                type: 'predicate',
                feature_type_property_id: 8,
                predicate: { type: 'boolean', operator: 'Equals', value: true }
              }
            ]
          }
        ]
      });
    });

    it('throws when predicate payload integrity is invalid', async () => {
      const service = new ExpressionTreeService(getMockDBConnection());

      sinon
        .stub(ExpressionRepository.prototype, 'getExpressionById')
        .resolves({ expression_id: 'expr-1', operator: 'AND', expression_hash: 'expr-hash-1' } as Expression);
      sinon.stub(ExpressionClauseRepository.prototype, 'getExpressionClausesByExpressionId').resolves([
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
