import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { getMockDBConnection, mockQueryResult } from '../__mocks__/db';
import { SubmissionFeaturePropertyIngestionRepository } from './submission-feature-property-ingestion-repository';

describe('SubmissionFeaturePropertyIngestionRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('insertTimestampPropertiesBySubmissionUploadId', () => {
    it('executes SQL phase', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repository = new SubmissionFeaturePropertyIngestionRepository(mockDBConnection);

      await repository.insertTimestampPropertiesBySubmissionUploadId('550e8400-e29b-41d4-a716-446655440000');

      expect(sqlStub.calledOnce).to.equal(true);
    });
  });

  describe('getIngestionErrorCountBySubmissionUploadId', () => {
    it('returns the count value from the query', async () => {
      const mockDBConnection = getMockDBConnection({
        sql: () => Promise.resolve(mockQueryResult([{ count: 7 }]))
      });
      const repository = new SubmissionFeaturePropertyIngestionRepository(mockDBConnection);

      const result = await repository.getIngestionErrorCountBySubmissionUploadId(
        '550e8400-e29b-41d4-a716-446655440000'
      );

      expect(result).to.equal(7);
    });
  });

  describe('getIngestionErrorCountsByCode', () => {
    it('returns grouped counts', async () => {
      const rows = [
        { error_code: 'TYPE_MISMATCH', error_count: 3 },
        { error_code: 'UNRESOLVED_TAXON', error_count: 1 }
      ];
      const mockDBConnection = getMockDBConnection({
        sql: () => Promise.resolve(mockQueryResult(rows))
      });
      const repository = new SubmissionFeaturePropertyIngestionRepository(mockDBConnection);

      const result = await repository.getIngestionErrorCountsByCode('550e8400-e29b-41d4-a716-446655440000');

      expect(result).to.eql(rows);
    });
  });

  describe('getIngestionErrorSamplesBySubmissionUploadId', () => {
    it('returns sample rows', async () => {
      const rows = [
        {
          submission_feature_id: 11,
          property_name: 'count',
          feature_type_property_id: 22,
          error_code: 'TYPE_MISMATCH',
          error_message: 'Property value type mismatch',
          raw_value: 'abc',
          details: null
        }
      ];
      const mockDBConnection = getMockDBConnection({
        sql: () => Promise.resolve(mockQueryResult(rows))
      });
      const repository = new SubmissionFeaturePropertyIngestionRepository(mockDBConnection);

      const result = await repository.getIngestionErrorSamplesBySubmissionUploadId(
        '550e8400-e29b-41d4-a716-446655440000',
        10
      );

      expect(result).to.eql(rows);
    });
  });

});
