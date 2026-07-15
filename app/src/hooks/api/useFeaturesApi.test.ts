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
          feature_type_name: 'survey',
          secured: false
        }
      };

      mock.onGet('api/submission/1/features/10').reply(200, mockResponse);

      const api = useFeaturesApi(axios);
      const result = await api.getSubmissionFeatureById('1', '10');

      expect(result).toEqual(mockResponse);
    });
  });

  describe('getSubmissionFeatureProperties', () => {
    it('should return paginated submission feature properties', async () => {
      const mockResponse = {
        properties: [{ id: 'species_name', property: 'species name', value: 'Wolf' }],
        pagination: {
          total: 1,
          current_page: 1,
          last_page: 1,
          per_page: 10,
          sort: 'property',
          order: 'asc'
        }
      };

      mock.onGet('api/submission/1/features/10/properties').reply((config) => {
        expect(config.params).toEqual({
          search: 'wolf',
          page: 1,
          limit: 10,
          sort: 'property',
          order: 'asc'
        });

        return [200, mockResponse];
      });

      const api = useFeaturesApi(axios);
      const result = await api.getSubmissionFeatureProperties('1', '10', {
        search: 'wolf',
        page: 1,
        limit: 10,
        sort: 'property',
        order: 'asc'
      });

      expect(result).toEqual(mockResponse);
    });
  });
});
