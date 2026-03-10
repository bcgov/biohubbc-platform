import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import { Code } from '../models/code';
import { getMockDBConnection, mockQueryResult } from '../__mocks__/db';
import { CodeTableRepository } from './code-table-repository';

describe('CodeTableRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  const mockRow: Code = {
    code_id: 1,
    code_category_id: 2,
    value: 'adult',
    label: 'Adult',
    description: 'Adult life stage',
    version: 'v1'
  };

  describe('insert', () => {
    it('returns inserted row', async () => {
      const repository = new CodeTableRepository(
        getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow])) })
      );

      const result = await repository.insertCode({
        code_category_id: 2,
        value: 'adult',
        label: 'Adult',
        description: 'Adult life stage',
        version: 'v1'
      });

      expect(result).to.eql(mockRow);
    });

    it('throws on failed insert', async () => {
      const repository = new CodeTableRepository(
        getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([])) })
      );

      try {
        await repository.insertCode({
          code_category_id: 2,
          value: 'adult',
          label: 'Adult'
        });
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
      }
    });
  });

  describe('getById', () => {
    it('returns row', async () => {
      const repository = new CodeTableRepository(
        getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow])) })
      );

      const result = await repository.getCodeById(1);
      expect(result).to.eql(mockRow);
    });

    it('throws not found', async () => {
      const repository = new CodeTableRepository(
        getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([])) })
      );

      try {
        await repository.getCodeById(1);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }
    });

    it('throws on unexpected row count', async () => {
      const repository = new CodeTableRepository(
        getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow], 2)) })
      );

      try {
        await repository.getCodeById(1);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
      }
    });
  });

  describe('lookups', () => {
    it('lists by code_category_id', async () => {
      const repository = new CodeTableRepository(
        getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow])) })
      );

      const result = await repository.getCodesByCodeCategoryId(2);
      expect(result).to.eql([mockRow]);
    });
  });
});
