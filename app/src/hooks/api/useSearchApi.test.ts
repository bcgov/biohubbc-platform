import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { PRIORITY_FEATURE_TYPE } from 'constants/feature-type';
import {
  GroupedPropertyResults,
  SearchFeatureResponse,
  SearchFeatureResultWithRelevancy,
  SearchPropertyResponse,
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
    it('should make POST request to /api/search/feature with keyword', async () => {
      const mockResults: SearchFeatureResultWithRelevancy[] = [
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

      const mockResponse: SearchFeatureResponse = {
        features: mockResults,
        pagination: {
          total: 1,
          per_page: 10,
          current_page: 1,
          last_page: 1,
          sort: 'relevance',
          order: 'desc'
        }
      };

      mock.onPost('/api/search/feature').reply(200, mockResponse);

      const result = await useSearchApi(axios).searchFeatures({ keyword: 'moose' });

      expect(result).toEqual(mockResponse);
      expect(mock.history.post[0].data).toEqual(
        JSON.stringify({
          filters: { keyword: 'moose' },
          pagination: undefined
        })
      );
    });

    it('should make POST request with filters and pagination', async () => {
      const mockResults: SearchFeatureResultWithRelevancy[] = [
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

      const mockResponse: SearchFeatureResponse = {
        features: mockResults,
        pagination: {
          total: 5,
          per_page: 10,
          current_page: 1,
          last_page: 1,
          sort: undefined,
          order: undefined
        }
      };

      mock.onPost('/api/search/feature').reply(200, mockResponse);

      const result = await useSearchApi(axios).searchFeatures(
        {
          feature_types: ['observation'],
          species: [1]
        },
        { page: 1, limit: 10 }
      );

      expect(result).toEqual(mockResponse);
      expect(mock.history.post[0].data).toEqual(
        JSON.stringify({
          filters: {
            feature_types: ['observation'],
            species: [1]
          },
          pagination: { page: 1, limit: 10 }
        })
      );
    });

    it('should return empty array when no results', async () => {
      const mockResponse: SearchFeatureResponse = {
        features: [],
        pagination: {
          total: 0,
          per_page: 10,
          current_page: 1,
          last_page: 1,
          sort: undefined,
          order: undefined
        }
      };

      mock.onPost('/api/search/feature').reply(200, mockResponse);

      const result = await useSearchApi(axios).searchFeatures({ keyword: 'nonexistent' });

      expect(result.features).toEqual([]);
      expect(result.pagination.total).toEqual(0);
    });
  });

  describe('searchProperties', () => {
    it('should make POST request to /api/search/property with filters', async () => {
      const mockGroupedResults: GroupedPropertyResults = {
        string: [{ feature_property_id: 1, property_name: 'species', relevancy_score: 0.9 }],
        number: [{ feature_property_id: 2, property_name: 'body_weight', relevancy_score: 0.8 }],
        datetime: [],
        spatial: []
      };

      const mockResponse: SearchPropertyResponse = {
        properties: mockGroupedResults,
        pagination: {
          total: 2,
          per_page: 10,
          current_page: 1,
          last_page: 1,
          sort: undefined,
          order: undefined
        }
      };

      mock.onPost('/api/search/property').reply(200, mockResponse);

      const result = await useSearchApi(axios).searchProperties(
        {
          keyword: 'weight',
          feature_types: ['observation']
        },
        { page: 1, limit: 10 }
      );

      expect(result).toEqual(mockResponse);
      expect(mock.history.post[0].data).toEqual(
        JSON.stringify({
          filters: {
            keyword: 'weight',
            feature_types: ['observation']
          },
          pagination: { page: 1, limit: 10 }
        })
      );
    });

    it('should return empty grouped results when no properties found', async () => {
      const mockResponse: SearchPropertyResponse = {
        properties: {
          string: [],
          number: [],
          datetime: [],
          spatial: []
        },
        pagination: {
          total: 0,
          per_page: 10,
          current_page: 1,
          last_page: 1,
          sort: undefined,
          order: undefined
        }
      };

      mock.onPost('/api/search/property').reply(200, mockResponse);

      const result = await useSearchApi(axios).searchProperties({ keyword: 'nonexistent' });

      expect(result.properties.string).toEqual([]);
      expect(result.properties.number).toEqual([]);
      expect(result.pagination.total).toEqual(0);
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

      const result = await useSearchApi(axios).searchAll({ keyword: 'test' }, { page: 1, limit: 10 });

      expect(result).toEqual(mockResponse);
      expect(mock.history.get[0].params).toEqual({ keyword: 'test', page: 1, limit: 10 });
    });

    it('should make GET request with feature_type_name filter', async () => {
      const mockResponse: SearchResponse = {
        features: { data: [], total: 0 },
        submissions: { data: [], total: 0 },
        taxonomy: { data: [], total: 0 }
      };

      mock.onGet('/api/search').reply(200, mockResponse);

      const result = await useSearchApi(axios).searchAll(
        { keyword: 'moose', feature_type_name: 'dataset' },
        { page: 1, limit: 10 }
      );

      expect(result).toEqual(mockResponse);
      expect(mock.history.get[0].params).toEqual({
        keyword: 'moose',
        feature_type_name: 'dataset',
        page: 1,
        limit: 10
      });
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

      const result = await useSearchApi(axios).searchSummary({ keyword: 'moose' });

      expect(result).toEqual(mockResponse);
      expect(mock.history.get[0].params).toEqual({ keyword: 'moose' });
    });

    it('should return summary with feature_type_name filter', async () => {
      const mockResponse: SearchSummaryResponse = {
        features: [{ feature_type_name: PRIORITY_FEATURE_TYPE.DATASET, total: 10 }],
        submissions: { total: 5 },
        taxonomy: { total: 8 }
      };

      mock.onGet('/api/search/summary').reply(200, mockResponse);

      const result = await useSearchApi(axios).searchSummary({
        keyword: 'wildlife',
        feature_type_name: 'dataset'
      });

      expect(result).toEqual(mockResponse);
      expect(mock.history.get[0].params).toEqual({
        keyword: 'wildlife',
        feature_type_name: 'dataset'
      });
    });
  });
});
