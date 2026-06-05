import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { getMockDBConnection, mockQueryResult } from '../__mocks__/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import { SubmissionFeaturePropertyNumber } from '../models/submission-feature-property-number';
import { SubmissionFeaturePropertyNumberRepository } from './submission-feature-property-number-repository';

describe('SubmissionFeaturePropertyNumberRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  const mockRow: SubmissionFeaturePropertyNumber = {
    submission_feature_property_number_id: 1,
    submission_feature_id: 10,
    feature_type_property_id: 20,
    value: 12
  };

  describe('insert', () => {
    it('returns inserted row', async () => {
      const mockDBConnection = getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow])) });
      const repository = new SubmissionFeaturePropertyNumberRepository(mockDBConnection);

      const result = await repository.insertSubmissionFeaturePropertyNumber({
        submission_feature_id: 10,
        feature_type_property_id: 20,
        value: 12
      });

      expect(result).to.eql(mockRow);
    });

    it('throws on failed insert', async () => {
      const mockDBConnection = getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([])) });
      const repository = new SubmissionFeaturePropertyNumberRepository(mockDBConnection);

      try {
        await repository.insertSubmissionFeaturePropertyNumber({
          submission_feature_id: 10,
          feature_type_property_id: 20,
          value: 12
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
      const repository = new SubmissionFeaturePropertyNumberRepository(mockDBConnection);
      const result = await repository.getSubmissionFeaturePropertyNumberById(1);
      expect(result).to.eql(mockRow);
    });

    it('throws not found', async () => {
      const mockDBConnection = getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([])) });
      const repository = new SubmissionFeaturePropertyNumberRepository(mockDBConnection);

      try {
        await repository.getSubmissionFeaturePropertyNumberById(1);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }
    });

    it('throws on unexpected row count', async () => {
      const mockDBConnection = getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow], 2)) });
      const repository = new SubmissionFeaturePropertyNumberRepository(mockDBConnection);

      try {
        await repository.getSubmissionFeaturePropertyNumberById(1);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
      }
    });
  });

  describe('lookups', () => {
    it('lists by submission_feature_id', async () => {
      const mockDBConnection = getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow])) });
      const repository = new SubmissionFeaturePropertyNumberRepository(mockDBConnection);
      const result = await repository.getSubmissionFeaturePropertyNumberBySubmissionFeatureId(10);
      expect(result).to.eql([mockRow]);
    });

    it('lists by feature_type_property_id', async () => {
      const mockDBConnection = getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow])) });
      const repository = new SubmissionFeaturePropertyNumberRepository(mockDBConnection);
      const result = await repository.getSubmissionFeaturePropertyNumberByFeatureTypePropertyId(20);
      expect(result).to.eql([mockRow]);
    });
  });
});
