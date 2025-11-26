import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { useFeaturesApi } from './useFeaturesApi';

describe('useFeaturesApi', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(axios);
  });

  afterEach(() => {
    mock.restore();
  });

  describe('getSubmissionFeatureById', () => {
    it('should return a submission feature response', async () => {
      const mockResponse = {
        feature: {
          submission_feature_id: 10,
          uuid: 'uuid',
          submission_id: 1,
          feature_type_id: 2,
          source_id: 'SIMS',
          data: {
            timestamp: '2020-01-01'
          },
          feature_type_name: 'dataset',
          secured: false
        }
      };

      mock.onGet('api/submission/1/features/10').reply(200, mockResponse);

      const api = useFeaturesApi(axios);
      const result = await api.getSubmissionFeatureById(1, 10);

      expect(result).toEqual(mockResponse);
    });
  });
});
