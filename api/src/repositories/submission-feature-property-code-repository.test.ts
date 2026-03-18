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
    contributor_codeset_code_id: 30
  };

  describe('insert', () => {
    it('returns inserted row', async () => {
      const repository = new SubmissionFeaturePropertyCodeRepository(
        getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow])) })
      );

      const result = await repository.insertSubmissionFeaturePropertyCode({
        submission_feature_id: 10,
        feature_type_property_id: 20,
        contributor_codeset_code_id: 30
      });

      expect(result).to.eql(mockRow);
    });

    it('throws on failed insert', async () => {
      const repository = new SubmissionFeaturePropertyCodeRepository(
        getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([])) })
      );

      try {
        await repository.insertSubmissionFeaturePropertyCode({
          submission_feature_id: 10,
          feature_type_property_id: 20,
          contributor_codeset_code_id: 30
        });
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
      }
    });
  });

  describe('getById', () => {
    it('returns row', async () => {
      const repository = new SubmissionFeaturePropertyCodeRepository(
        getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow])) })
      );

      const result = await repository.getSubmissionFeaturePropertyCodeById(1);
      expect(result).to.eql(mockRow);
    });

    it('throws not found', async () => {
      const repository = new SubmissionFeaturePropertyCodeRepository(
        getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([])) })
      );

      try {
        await repository.getSubmissionFeaturePropertyCodeById(1);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }
    });

    it('throws on unexpected row count', async () => {
      const repository = new SubmissionFeaturePropertyCodeRepository(
        getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow], 2)) })
      );

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
      const repository = new SubmissionFeaturePropertyCodeRepository(
        getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow])) })
      );

      const result = await repository.getSubmissionFeaturePropertyCodesBySubmissionFeatureId(10);
      expect(result).to.eql([mockRow]);
    });

    it('lists by feature_type_property_id', async () => {
      const repository = new SubmissionFeaturePropertyCodeRepository(
        getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow])) })
      );

      const result = await repository.getSubmissionFeaturePropertyCodesByFeatureTypePropertyId(20);
      expect(result).to.eql([mockRow]);
    });

    it('lists by contributor_codeset_code_id', async () => {
      const repository = new SubmissionFeaturePropertyCodeRepository(
        getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow])) })
      );

      const result = await repository.getSubmissionFeaturePropertyCodesByContributorCodesetCodeId(30);
      expect(result).to.eql([mockRow]);
    });
  });
});
