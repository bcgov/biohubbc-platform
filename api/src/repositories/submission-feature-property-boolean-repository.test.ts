import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { getMockDBConnection, mockQueryResult } from '../__mocks__/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import { SubmissionFeaturePropertyBoolean } from '../models/submission-feature-property-boolean';
import { SubmissionFeaturePropertyBooleanRepository } from './submission-feature-property-boolean-repository';

describe('SubmissionFeaturePropertyBooleanRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  const mockRow: SubmissionFeaturePropertyBoolean = {
    submission_feature_property_boolean_id: 1,
    submission_feature_id: 10,
    feature_type_property_id: 20,
    value: true
  };

  describe('insert', () => {
    it('returns inserted row', async () => {
      const mockDBConnection = getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow])) });
      const repository = new SubmissionFeaturePropertyBooleanRepository(mockDBConnection);

      const result = await repository.insertSubmissionFeaturePropertyBoolean({
        submission_feature_id: 10,
        feature_type_property_id: 20,
        value: true
      });

      expect(result).to.eql(mockRow);
    });

    it('throws on failed insert', async () => {
      const mockDBConnection = getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([])) });
      const repository = new SubmissionFeaturePropertyBooleanRepository(mockDBConnection);

      try {
        await repository.insertSubmissionFeaturePropertyBoolean({
          submission_feature_id: 10,
          feature_type_property_id: 20,
          value: true
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
      const repository = new SubmissionFeaturePropertyBooleanRepository(mockDBConnection);
      const result = await repository.getSubmissionFeaturePropertyBooleanById(1);
      expect(result).to.eql(mockRow);
    });

    it('throws not found', async () => {
      const mockDBConnection = getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([])) });
      const repository = new SubmissionFeaturePropertyBooleanRepository(mockDBConnection);

      try {
        await repository.getSubmissionFeaturePropertyBooleanById(1);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }
    });

    it('throws on unexpected row count', async () => {
      const mockDBConnection = getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow], 2)) });
      const repository = new SubmissionFeaturePropertyBooleanRepository(mockDBConnection);

      try {
        await repository.getSubmissionFeaturePropertyBooleanById(1);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
      }
    });
  });

  describe('lookups', () => {
    it('lists by submission_feature_id', async () => {
      const mockDBConnection = getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow])) });
      const repository = new SubmissionFeaturePropertyBooleanRepository(mockDBConnection);
      const result = await repository.getSubmissionFeaturePropertyBooleanBySubmissionFeatureId(10);
      expect(result).to.eql([mockRow]);
    });

    it('lists by feature_type_property_id', async () => {
      const mockDBConnection = getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow])) });
      const repository = new SubmissionFeaturePropertyBooleanRepository(mockDBConnection);
      const result = await repository.getSubmissionFeaturePropertyBooleanByFeatureTypePropertyId(20);
      expect(result).to.eql([mockRow]);
    });
  });
});
