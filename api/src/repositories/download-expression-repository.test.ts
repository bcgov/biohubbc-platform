import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { getMockDBConnection, mockQueryResult } from '../__mocks__/db';
import { ApiNotFoundError } from '../errors/api-error';
import { DownloadExpressionRepository } from './download-expression-repository';

const downloadExpressionRow = {
  download_expression_id: 'de-1',
  download_id: 'download-1',
  expression_id: 'expr-1'
};

describe('DownloadExpressionRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('insertDownloadExpression', () => {
    it('returns inserted download_expression row', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([downloadExpressionRow], 1));
      const repository = new DownloadExpressionRepository(getMockDBConnection({ knex: knexStub }));

      const result = await repository.insertDownloadExpression({
        download_id: 'download-1',
        expression_id: 'expr-1'
      });

      expect(result).to.eql(downloadExpressionRow);
    });
  });

  describe('getDownloadExpressionById', () => {
    it('throws not found when row is missing', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([], 0));
      const repository = new DownloadExpressionRepository(getMockDBConnection({ knex: knexStub }));

      try {
        await repository.getDownloadExpressionById('de-missing');
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }
    });
  });

  describe('deleteDownloadExpressionsByDownloadId', () => {
    it('soft deletes active rows and returns deleted links', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([downloadExpressionRow], 1));
      const repository = new DownloadExpressionRepository(getMockDBConnection({ knex: knexStub }));

      const result = await repository.deleteDownloadExpressionsByDownloadId('download-1');

      expect(result).to.eql([downloadExpressionRow]);
      expect(knexStub.callCount).to.equal(1);
    });
  });
});
