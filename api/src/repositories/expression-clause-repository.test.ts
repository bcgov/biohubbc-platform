import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { getMockDBConnection, mockQueryResult } from '../__mocks__/db';
import { ExpressionClauseRepository } from './expression-clause-repository';

const expressionClauseRow = {
  expression_clause_id: '72f5a4c2-dde4-4f15-b75b-497f4f7724d6',
  expression_id: '90f0d0df-0bbb-479c-a84b-6d62a7e6b9fb',
  sequence: 1,
  predicate_id: 'cad3d2ef-639c-4d4d-8e69-b550ecf45fa8',
  child_expression_id: null
};

describe('ExpressionClauseRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('insertExpressionClauses', () => {
    it('returns inserted rows', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([expressionClauseRow], 1));
      const repository = new ExpressionClauseRepository(getMockDBConnection({ knex: knexStub }));

      const result = await repository.insertExpressionClauses([
        {
          expression_id: expressionClauseRow.expression_id,
          sequence: 1,
          predicate_id: expressionClauseRow.predicate_id,
          child_expression_id: null
        }
      ]);

      expect(result).to.eql([expressionClauseRow]);
      expect(knexStub.callCount).to.equal(1);
    });

    it('returns empty array when no payloads are provided', async () => {
      const knexStub = sinon.stub();
      const repository = new ExpressionClauseRepository(getMockDBConnection({ knex: knexStub }));

      const result = await repository.insertExpressionClauses([]);

      expect(result).to.eql([]);
      expect(knexStub.callCount).to.equal(0);
    });
  });

  describe('getExpressionClausesByExpressionId', () => {
    it('returns ordered active expression clauses', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([expressionClauseRow], 1));
      const repository = new ExpressionClauseRepository(getMockDBConnection({ knex: knexStub }));

      const result = await repository.getExpressionClausesByExpressionId(expressionClauseRow.expression_id);

      expect(result).to.eql([expressionClauseRow]);
      expect(knexStub.callCount).to.equal(1);
    });
  });
});
