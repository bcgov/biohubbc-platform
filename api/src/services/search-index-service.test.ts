import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { SearchIndexService } from './search-index-service';
import { SearchIndexRepository } from '../repositories/search-index-respository';
import { SubmissionRepository } from '../repositories/submission-repository';

chai.use(sinonChai);

describe('SearchIndexService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('indexFeaturesBySubmissionId', () => {
    it('should correctly index a submission', async () => {
      const mockDBConnection = getMockDBConnection();

      const searchIndexService = new SearchIndexService(mockDBConnection);

      const mockFeaturePropertyTypes = [
        { feature_property_type_id: 1, name: 'string' },
        { feature_property_type_id: 2, name: 'number' },
        { feature_property_type_id: 3, name: 'datetime' },
        { feature_property_type_id: 4, name: 'spatial' },
        { feature_property_type_id: 5, name: 'boolean' },
        { feature_property_type_id: 6, name: 'object' },
        { feature_property_type_id: 7, name: 'array' }
      ]

      const mockFeatureTypes = [
        {
          feature_type_id: 1,
          name: 'dataset'
        },
        {
          feature_type_id: 2,
          name: 'observation'
        }
      ]


      const getFeaturesStub = sinon
        .stub(SubmissionRepository.prototype, 'getSubmissionFeaturesBySubmissionId')
        .resolves([
          {
            submission_feature_id: 1,
            submission_id: 1, // Mock submission
            feature_type_id: 1, // dataset
            data: {
              //
            }
          }
        ])

    });
  });
});
