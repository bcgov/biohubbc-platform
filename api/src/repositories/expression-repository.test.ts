import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { getMockDBConnection, mockQueryResult } from '../__mocks__/db';
import { ApiNotFoundError } from '../errors/api-error';
import { ExpressionRepository } from './expression-repository';

const expressionRow = {
  expression_id: '72f5a4c2-dde4-4f15-b75b-497f4f7724d6',
  operator: 'AND',
  expression_hash: 'hash-1'
};

describe('ExpressionRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('insertExpressionAnchor', () => {
    it('returns inserted expression row when a new expression is inserted', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([{ ...expressionRow, inserted: true }], 1));
      const repository = new ExpressionRepository(getMockDBConnection({ knex: knexStub }));

      const result = await repository.insertExpressionAnchor('AND', 'hash-1');
      expect(result).to.eql({ ...expressionRow, inserted: true });
      expect(knexStub.callCount).to.equal(1);
      expect(knexStub.firstCall.args[0].toString()).to.not.include('ON CONFLICT');
    });
  });

  describe('findExpressionByHash', () => {
    it('returns active expression by hash', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([expressionRow], 1));
      const repository = new ExpressionRepository(getMockDBConnection({ knex: knexStub }));

      const result = await repository.findExpressionByHash('hash-1');

      expect(result).to.eql(expressionRow);
      expect(knexStub.callCount).to.equal(1);
    });

    it('returns null when missing', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([], 0));
      const repository = new ExpressionRepository(getMockDBConnection({ knex: knexStub }));

      const result = await repository.findExpressionByHash('hash-1');
      expect(result).to.equal(null);
    });
  });

  describe('getExpressionById', () => {
    it('returns expression by id', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([expressionRow], 1));
      const repository = new ExpressionRepository(getMockDBConnection({ knex: knexStub }));

      const result = await repository.getExpressionById(expressionRow.expression_id);

      expect(knexStub.callCount).to.equal(1);
      expect(result).to.eql(expressionRow);
    });

    it('throws not found when missing', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([], 0));
      const repository = new ExpressionRepository(getMockDBConnection({ knex: knexStub }));

      try {
        await repository.getExpressionById(expressionRow.expression_id);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }
    });
  });

  describe('getExpressionsByHashes', () => {
    it('returns active expression hash rows for provided hashes', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([expressionRow], 1));
      const repository = new ExpressionRepository(getMockDBConnection({ knex: knexStub }));

      const result = await repository.getExpressionsByHashes(['hash-1', 'hash-1']);

      expect(result).to.eql([expressionRow]);
      expect(knexStub.callCount).to.equal(1);
    });
  });
});
