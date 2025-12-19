import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { SearchFeatureResult } from 'interfaces/useSearchApi.interface';
import { useSearchApi } from './useSearchApi';

describe('useSearchApi', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(axios);
  });

  afterEach(() => {
    mock.restore();
  });

  describe('searchFeatures', () => {
    it('should make POST request to /api/search with keywords', async () => {
      const mockResults: SearchFeatureResult[] = [
        {
          submission_feature_id: 1,
          submission_id: 10,
          uuid: '550e8400-e29b-41d4-a716-446655440001',
          feature_type_id: 1,
          feature_type_name: 'dataset',
          feature_name: 'Moose Study',
          feature_description: 'A study of moose habitat',
          submission_name: 'Wildlife Project',
          is_secured: false,
          relevancy_score: 0.75
        }
      ];

      mock.onPost('/api/search').reply(200, mockResults);

      const result = await useSearchApi(axios).searchFeatures({ keywords: 'moose' });

      expect(result).toEqual(mockResults);
      expect(mock.history.post[0].data).toEqual(JSON.stringify({ keywords: 'moose' }));
    });

    it('should make POST request with property filters', async () => {
      const mockResults: SearchFeatureResult[] = [
        {
          submission_feature_id: 2,
          submission_id: 11,
          uuid: '550e8400-e29b-41d4-a716-446655440002',
          feature_type_id: 2,
          feature_type_name: 'observation',
          feature_name: 'Bear Sighting',
          feature_description: null,
          submission_name: 'Species Census',
          is_secured: true,
          relevancy_score: 0.6
        }
      ];

      mock.onPost('/api/search').reply(200, mockResults);

      const result = await useSearchApi(axios).searchFeatures({
        propertyFilters: [{ featureTypeName: 'animal', propertyName: 'species', propertyType: 'string', value: 'bear' }]
      });

      expect(result).toEqual(mockResults);
      expect(mock.history.post[0].data).toEqual(
        JSON.stringify({
          propertyFilters: [
            { featureTypeName: 'animal', propertyName: 'species', propertyType: 'string', value: 'bear' }
          ]
        })
      );
    });

    it('should return empty array when no results', async () => {
      mock.onPost('/api/search').reply(200, []);

      const result = await useSearchApi(axios).searchFeatures({ keywords: 'nonexistent' });

      expect(result).toEqual([]);
    });
  });
});
