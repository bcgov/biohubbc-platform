import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { getMockDBConnection, mockQueryResult } from '../__mocks__/db';
import { SubmissionFeaturePropertyIndexRepository } from './submission-feature-property-index-repository';

describe('SubmissionFeaturePropertyIndexRepository', () => {
  describe('getFeatureTypePropertyClassificationsByFeatureTypeIds', () => {
    it('returns parsed property classifications for all requested feature types', async () => {
      const rows = [
        {
          metadata: {
            feature_type_id: 10,
            feature_type_property_id: 100,
            name: 'species',
            display_name: 'Species',
            description: 'Species',
            type_name: 'string',
            required_value: false,
            calculated_value: false,
            allow_multiple: false
          }
        },
        {
          metadata: {
            feature_type_id: 11,
            feature_type_property_id: 110,
            name: 'taxon_tsn',
            display_name: 'Taxon TSN',
            description: 'Taxon TSN',
            type_name: 'taxon',
            required_value: false,
            calculated_value: false,
            allow_multiple: true
          }
        }
      ];

      const mockDBConnection = getMockDBConnection({
        sql: () => Promise.resolve(mockQueryResult(rows))
      });
      const repository = new SubmissionFeaturePropertyIndexRepository(mockDBConnection);

      const result = await repository.getFeatureTypePropertyClassificationsByFeatureTypeIds([10, 11]);

      expect(result).to.eql(rows.map((row) => row.metadata));
    });

    it('returns an empty array when no feature type ids are provided', async () => {
      const mockDBConnection = getMockDBConnection();
      const repository = new SubmissionFeaturePropertyIndexRepository(mockDBConnection);

      const result = await repository.getFeatureTypePropertyClassificationsByFeatureTypeIds([]);

      expect(result).to.eql([]);
    });
  });

  describe('streamSubmissionFeaturesBySubmissionUploadId', () => {
    it('throws when batchSize is not a positive integer', async () => {
      const sqlStub = sinon.stub();
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repository = new SubmissionFeaturePropertyIndexRepository(mockDBConnection);

      try {
        const stream = repository.streamSubmissionFeaturesBySubmissionUploadId('upload-uuid', 0);
        await stream.next();
        expect.fail();
      } catch (error) {
        expect((error as Error).message).to.equal('Invalid batch size for submission feature streaming');
      }

      expect(sqlStub.called).to.equal(false);
    });
  });
});
