import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import { SubmissionFeaturePropertyCode } from '../models/submission-feature-property-code';
import { getMockDBConnection, mockQueryResult } from '../__mocks__/db';
import { SubmissionFeaturePropertyCodeRepository } from './submission-feature-property-code-repository';

describe('SubmissionFeaturePropertyCodeRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  const mockRow: SubmissionFeaturePropertyCode = {
    submission_feature_property_code_id: 1,
    submission_feature_id: 10,
    feature_type_property_id: 20,
    code_id: 9001
  };

  describe('insert', () => {
    it('returns inserted row', async () => {
      const mockDBConnection = getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow])) });
      const repository = new SubmissionFeaturePropertyCodeRepository(mockDBConnection);

      const result = await repository.insertSubmissionFeaturePropertyCode({
        submission_feature_id: 10,
        feature_type_property_id: 20,
        code_id: 9001
      });

      expect(result).to.eql(mockRow);
    });

    it('throws on failed insert', async () => {
      const mockDBConnection = getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([])) });
      const repository = new SubmissionFeaturePropertyCodeRepository(mockDBConnection);

      try {
        await repository.insertSubmissionFeaturePropertyCode({
          submission_feature_id: 10,
          feature_type_property_id: 20,
          code_id: 9001
        });
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
      }
    });
  });

  describe('getById', () => {
    it('returns row', async () => {
      const mockDBConnection = getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow])) });
      const repository = new SubmissionFeaturePropertyCodeRepository(mockDBConnection);
      const result = await repository.getSubmissionFeaturePropertyCodeById(1);
      expect(result).to.eql(mockRow);
    });

    it('throws not found', async () => {
      const mockDBConnection = getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([])) });
      const repository = new SubmissionFeaturePropertyCodeRepository(mockDBConnection);

      try {
        await repository.getSubmissionFeaturePropertyCodeById(1);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }
    });

    it('throws on unexpected row count', async () => {
      const mockDBConnection = getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow], 2)) });
      const repository = new SubmissionFeaturePropertyCodeRepository(mockDBConnection);

      try {
        await repository.getSubmissionFeaturePropertyCodeById(1);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
      }
    });
  });

  describe('lookups', () => {
    it('lists by submission_feature_id', async () => {
      const mockDBConnection = getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow])) });
      const repository = new SubmissionFeaturePropertyCodeRepository(mockDBConnection);
      const result = await repository.getSubmissionFeaturePropertyCodeBySubmissionFeatureId(10);
      expect(result).to.eql([mockRow]);
    });

    it('lists by feature_type_property_id', async () => {
      const mockDBConnection = getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow])) });
      const repository = new SubmissionFeaturePropertyCodeRepository(mockDBConnection);
      const result = await repository.getSubmissionFeaturePropertyCodeByFeatureTypePropertyId(20);
      expect(result).to.eql([mockRow]);
    });
  });
});
