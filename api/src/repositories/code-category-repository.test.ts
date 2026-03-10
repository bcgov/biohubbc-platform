import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import { CodeCategory } from '../models/code-category';
import { getMockDBConnection, mockQueryResult } from '../__mocks__/db';
import { CodeCategoryRepository } from './code-category-repository';

describe('CodeCategoryRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  const mockRow: CodeCategory = {
    code_category_id: 1,
    contributor_id: 10,
    value: 'life_stage',
    label: 'Life stage',
    description: 'Life stage codes',
    version: 'v1'
  };

  describe('insert', () => {
    it('returns inserted row', async () => {
      const repository = new CodeCategoryRepository(
        getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow])) })
      );

      const result = await repository.insertCodeCategory({
        contributor_id: 10,
        value: 'life_stage',
        label: 'Life stage',
        description: 'Life stage codes',
        version: 'v1'
      });

      expect(result).to.eql(mockRow);
    });

    it('throws on failed insert', async () => {
      const repository = new CodeCategoryRepository(
        getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([])) })
      );

      try {
        await repository.insertCodeCategory({
          contributor_id: 10,
          value: 'life_stage',
          label: 'Life stage'
        });
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
      }
    });
  });

  describe('getById', () => {
    it('returns row', async () => {
      const repository = new CodeCategoryRepository(
        getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow])) })
      );

      const result = await repository.getCodeCategoryById(1);
      expect(result).to.eql(mockRow);
    });

    it('throws not found', async () => {
      const repository = new CodeCategoryRepository(
        getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([])) })
      );

      try {
        await repository.getCodeCategoryById(1);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }
    });

    it('throws on unexpected row count', async () => {
      const repository = new CodeCategoryRepository(
        getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow], 2)) })
      );

      try {
        await repository.getCodeCategoryById(1);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
      }
    });
  });

  describe('lookups', () => {
    it('lists by contributor_id', async () => {
      const repository = new CodeCategoryRepository(
        getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow])) })
      );

      const result = await repository.getCodeCategoriesByContributorId(10);
      expect(result).to.eql([mockRow]);
    });
  });
});
