import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { PRIORITY_FEATURE_TYPE } from 'constants/feature-type';
import {
  SearchFeatureResultWithRelevance,
  SearchResponse,
  SearchSummaryResponse
} from 'interfaces/useSearchApi.interface';
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
    it('should make POST request to /api/search/feature with keywords', async () => {
      const mockResults: SearchFeatureResultWithRelevance[] = [
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

      mock.onPost('/api/search/feature').reply(200, mockResults);

      const result = await useSearchApi(axios).searchFeatures({ keywords: 'moose' });

      expect(result).toEqual(mockResults);
      expect(mock.history.post[0].data).toEqual(JSON.stringify({ keywords: 'moose' }));
    });

    it('should make POST request with property filters', async () => {
      const mockResults: SearchFeatureResultWithRelevance[] = [
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

      mock.onPost('/api/search/feature').reply(200, mockResults);

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
      mock.onPost('/api/search/feature').reply(200, []);

      const result = await useSearchApi(axios).searchFeatures({ keywords: 'nonexistent' });

      expect(result).toEqual([]);
    });
  });

  describe('searchAll', () => {
    it('should make GET request to /api/search with query params', async () => {
      const mockResponse: SearchResponse = {
        features: { data: [{ submission_feature_id: 1, label: 'Label', feature_type_id: 1 }], total: 5000 },
        submissions: { data: [], total: 1 },
        taxonomy: { data: [], total: 0 }
      };

      mock.onGet('/api/search').reply(200, mockResponse);

      const result = await useSearchApi(axios).searchAll({ search: 'test' }, { page: 1, limit: 10 });

      expect(result).toEqual(mockResponse);
      expect(mock.history.get[0].params).toEqual({ search: 'test', page: 1, limit: 10 });
    });
  });

  describe('searchSummary', () => {
    it('should make GET request to /api/search/summary and return typed summary', async () => {
      const mockResponse: SearchSummaryResponse = {
        features: [
          { feature_type_name: PRIORITY_FEATURE_TYPE.DATASET, total: 5 },
          { feature_type_name: PRIORITY_FEATURE_TYPE.REPORT, total: 3 }
        ],
        submissions: { total: 2 },
        taxonomy: { total: 4 }
      };

      mock.onGet('/api/search/summary').reply(200, mockResponse);

      const result = await useSearchApi(axios).searchSummary({ search: 'moose' });

      expect(result).toEqual(mockResponse);

      expect(mock.history.get[0].params).toEqual({ search: 'moose', page: 1, limit: 10 });
    });
  });
});
