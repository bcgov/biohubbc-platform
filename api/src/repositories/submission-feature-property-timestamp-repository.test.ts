import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { getMockDBConnection, mockQueryResult } from '../__mocks__/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import { SubmissionFeaturePropertyTimestamp } from '../models/submission-feature-property-timestamp';
import { SubmissionFeaturePropertyTimestampRepository } from './submission-feature-property-timestamp-repository';

describe('SubmissionFeaturePropertyTimestampRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  const mockRow: SubmissionFeaturePropertyTimestamp = {
    submission_feature_property_timestamp_id: 1,
    submission_feature_id: 10,
    blueprint_feature_type_property_id: 20,
    date_value: '2026-01-01',
    time_value: '00:00:00'
  };

  describe('insert', () => {
    it('returns inserted row', async () => {
      const mockDBConnection = getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow])) });
      const repository = new SubmissionFeaturePropertyTimestampRepository(mockDBConnection);

      const result = await repository.insertSubmissionFeaturePropertyTimestamp({
        submission_feature_id: 10,
        blueprint_feature_type_property_id: 20,
        date_value: '2026-01-01',
        time_value: '00:00:00'
      });

      expect(result).to.eql(mockRow);
    });

    it('throws on failed insert', async () => {
      const mockDBConnection = getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([])) });
      const repository = new SubmissionFeaturePropertyTimestampRepository(mockDBConnection);

      try {
        await repository.insertSubmissionFeaturePropertyTimestamp({
          submission_feature_id: 10,
          blueprint_feature_type_property_id: 20,
          date_value: '2026-01-01',
          time_value: '00:00:00'
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
      const repository = new SubmissionFeaturePropertyTimestampRepository(mockDBConnection);
      const result = await repository.getSubmissionFeaturePropertyTimestampById(1);
      expect(result).to.eql(mockRow);
    });

    it('throws not found', async () => {
      const mockDBConnection = getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([])) });
      const repository = new SubmissionFeaturePropertyTimestampRepository(mockDBConnection);

      try {
        await repository.getSubmissionFeaturePropertyTimestampById(1);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }
    });

    it('throws on unexpected row count', async () => {
      const mockDBConnection = getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow], 2)) });
      const repository = new SubmissionFeaturePropertyTimestampRepository(mockDBConnection);

      try {
        await repository.getSubmissionFeaturePropertyTimestampById(1);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
      }
    });
  });

  describe('lookups', () => {
    it('lists by submission_feature_id', async () => {
      const mockDBConnection = getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow])) });
      const repository = new SubmissionFeaturePropertyTimestampRepository(mockDBConnection);
      const result = await repository.getSubmissionFeaturePropertyTimestampBySubmissionFeatureId(10);
      expect(result).to.eql([mockRow]);
    });

    it('lists by blueprint_feature_type_property_id', async () => {
      const mockDBConnection = getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow])) });
      const repository = new SubmissionFeaturePropertyTimestampRepository(mockDBConnection);
      const result = await repository.getSubmissionFeaturePropertyTimestampByBlueprintFeatureTypePropertyId(20);
      expect(result).to.eql([mockRow]);
    });
  });
});
