import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import { SubmissionFeaturePropertyString } from '../models/submission-feature-property-string';
import { getMockDBConnection, mockQueryResult } from '../__mocks__/db';
import { SubmissionFeaturePropertyStringRepository } from './submission-feature-property-string-repository';

describe('SubmissionFeaturePropertyStringRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  const mockRow: SubmissionFeaturePropertyString = {
    submission_feature_property_string_id: 1,
    submission_feature_id: 10,
    feature_type_property_id: 20,
    value: 'alpha'
  };

  describe('insert', () => {
    it('returns inserted row', async () => {
      const mockDBConnection = getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow])) });
      const repository = new SubmissionFeaturePropertyStringRepository(mockDBConnection);

      const result = await repository.insertSubmissionFeaturePropertyString({
        submission_feature_id: 10,
        feature_type_property_id: 20,
        value: 'alpha'
      });

      expect(result).to.eql(mockRow);
    });

    it('throws on failed insert', async () => {
      const mockDBConnection = getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([])) });
      const repository = new SubmissionFeaturePropertyStringRepository(mockDBConnection);

      try {
        await repository.insertSubmissionFeaturePropertyString({
          submission_feature_id: 10,
          feature_type_property_id: 20,
          value: 'alpha'
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
      const repository = new SubmissionFeaturePropertyStringRepository(mockDBConnection);
      const result = await repository.getSubmissionFeaturePropertyStringById(1);
      expect(result).to.eql(mockRow);
    });

    it('throws not found', async () => {
      const mockDBConnection = getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([])) });
      const repository = new SubmissionFeaturePropertyStringRepository(mockDBConnection);

      try {
        await repository.getSubmissionFeaturePropertyStringById(1);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }
    });

    it('throws on unexpected row count', async () => {
      const mockDBConnection = getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow], 2)) });
      const repository = new SubmissionFeaturePropertyStringRepository(mockDBConnection);

      try {
        await repository.getSubmissionFeaturePropertyStringById(1);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
      }
    });
  });

  describe('lookups', () => {
    it('lists by submission_feature_id', async () => {
      const mockDBConnection = getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow])) });
      const repository = new SubmissionFeaturePropertyStringRepository(mockDBConnection);
      const result = await repository.getSubmissionFeaturePropertyStringBySubmissionFeatureId(10);
      expect(result).to.eql([mockRow]);
    });

    it('lists by feature_type_property_id', async () => {
      const mockDBConnection = getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow])) });
      const repository = new SubmissionFeaturePropertyStringRepository(mockDBConnection);
      const result = await repository.getSubmissionFeaturePropertyStringByFeatureTypePropertyId(20);
      expect(result).to.eql([mockRow]);
    });
  });
});
