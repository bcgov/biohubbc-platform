import chai, { expect } from 'chai';
import dayjs from 'dayjs';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { SearchFeatureRepository } from '../repositories/search-feature-repository';
import { SearchFeatureService } from './search-feature-service';
import { SearchFeatureResultWithRelevancy } from './search-feature-service.interface';

chai.use(sinonChai);

describe('SearchFeatureService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('searchFeatures', () => {
    it('should return features matching keyword search', async () => {
      const mockDBConnection = getMockDBConnection();
      const searchFeatureService = new SearchFeatureService(mockDBConnection);

      const mockResults: SearchFeatureResultWithRelevancy[] = [
        {
          submission_feature_id: 1,
          submission_id: 10,
          uuid: '550e8400-e29b-41d4-a716-446655440001',
          feature_type_id: 1,
          feature_type_name: 'dataset',
          feature_name: 'Moose Study',
          feature_description: 'A study of moose',
          submission_name: 'Wildlife Project',
          is_secured: false,
          relevancy_score: 0.5,
          create_date: dayjs().toISOString()
        }
      ];

      sinon.stub(SearchFeatureRepository.prototype, 'searchFeaturesByFilters').resolves(mockResults);

      const result = await searchFeatureService.searchFeatures({ keyword: 'moose' });

      expect(result).to.have.lengthOf(1);
      expect(result[0].submission_feature_id).to.equal(1);
    });

    it('should return features filtered by feature type', async () => {
      const mockDBConnection = getMockDBConnection();
      const searchFeatureService = new SearchFeatureService(mockDBConnection);

      const mockResults: SearchFeatureResultWithRelevancy[] = [
        {
          submission_feature_id: 1,
          submission_id: 10,
          uuid: '550e8400-e29b-41d4-a716-446655440001',
          feature_type_id: 1,
          feature_type_name: 'dataset',
          feature_name: 'Moose Data',
          feature_description: 'Moose dataset',
          submission_name: 'Wildlife Project',
          is_secured: false,
          relevancy_score: 1.0,
          create_date: dayjs().toISOString()
        }
      ];

      sinon.stub(SearchFeatureRepository.prototype, 'searchFeaturesByFilters').resolves(mockResults);

      const result = await searchFeatureService.searchFeatures({ feature_types: ['dataset'] });

      expect(result).to.have.lengthOf(1);
      expect(result[0].feature_type_name).to.equal('dataset');
    });

    it('should return features filtered by species', async () => {
      const mockDBConnection = getMockDBConnection();
      const searchFeatureService = new SearchFeatureService(mockDBConnection);

      const mockResults: SearchFeatureResultWithRelevancy[] = [
        {
          submission_feature_id: 1,
          submission_id: 10,
          uuid: '550e8400-e29b-41d4-a716-446655440001',
          feature_type_id: 2,
          feature_type_name: 'observation',
          feature_name: 'Moose Sighting',
          feature_description: null,
          submission_name: 'Wildlife Project',
          is_secured: false,
          relevancy_score: 1.0,

          create_date: dayjs().toISOString()
        }
      ];

      sinon.stub(SearchFeatureRepository.prototype, 'searchFeaturesByFilters').resolves(mockResults);

      const result = await searchFeatureService.searchFeatures({ species: ['Alces alces'] });

      expect(result).to.have.lengthOf(1);
      expect(result[0].submission_feature_id).to.equal(1);
    });

    it('should return features filtered by property conditions', async () => {
      const mockDBConnection = getMockDBConnection();
      const searchFeatureService = new SearchFeatureService(mockDBConnection);

      const mockResults: SearchFeatureResultWithRelevancy[] = [
        {
          submission_feature_id: 1,
          submission_id: 10,
          uuid: '550e8400-e29b-41d4-a716-446655440001',
          feature_type_id: 1,
          feature_type_name: 'dataset',
          feature_name: 'Data',
          feature_description: null,
          submission_name: 'Project',
          is_secured: false,
          relevancy_score: 1.0,

          create_date: dayjs().toISOString()
        }
      ];

      sinon.stub(SearchFeatureRepository.prototype, 'searchFeaturesByFilters').resolves(mockResults);

      const result = await searchFeatureService.searchFeatures({
        properties: [
          {
            operand: 'and',
            conditions: [
              {
                name: 'count',
                operator: 'gt',
                value: '10'
              }
            ]
          }
        ]
      });

      expect(result).to.have.lengthOf(1);
    });

    it('should apply pagination to search results', async () => {
      const mockDBConnection = getMockDBConnection();
      const searchFeatureService = new SearchFeatureService(mockDBConnection);

      const mockResults: SearchFeatureResultWithRelevancy[] = [
        {
          submission_feature_id: 1,
          submission_id: 10,
          uuid: '550e8400-e29b-41d4-a716-446655440001',
          feature_type_id: 1,
          feature_type_name: 'dataset',
          feature_name: 'Data 1',
          feature_description: null,
          submission_name: 'Project',
          is_secured: false,
          relevancy_score: 1.0,

          create_date: dayjs().toISOString()
        }
      ];

      const searchStub = sinon.stub(SearchFeatureRepository.prototype, 'searchFeaturesByFilters').resolves(mockResults);

      await searchFeatureService.searchFeatures({ keyword: 'data' }, { page: 1, limit: 10 });

      expect(searchStub).to.be.calledOnceWith({ keyword: 'data' }, { page: 1, limit: 10 }, undefined);
    });

    it('should return empty array for no matches', async () => {
      const mockDBConnection = getMockDBConnection();
      const searchFeatureService = new SearchFeatureService(mockDBConnection);

      sinon.stub(SearchFeatureRepository.prototype, 'searchFeaturesByFilters').resolves([]);

      const result = await searchFeatureService.searchFeatures({ keyword: 'nonexistent' });

      expect(result).to.eql([]);
    });

    it('should return empty array with empty filters', async () => {
      const mockDBConnection = getMockDBConnection();
      const searchFeatureService = new SearchFeatureService(mockDBConnection);

      const result = await searchFeatureService.searchFeatures({});

      expect(result).to.eql([]);
    });
  });

  describe('getSearchFeaturesCount', () => {
    it('should return count for keyword search', async () => {
      const mockDBConnection = getMockDBConnection();
      const searchFeatureService = new SearchFeatureService(mockDBConnection);

      sinon.stub(SearchFeatureRepository.prototype, 'searchFeaturesByFiltersCount').resolves(5);

      const result = await searchFeatureService.getSearchFeaturesCount({ keyword: 'moose' });

      expect(result).to.equal(5);
    });

    it('should return count for feature type filter', async () => {
      const mockDBConnection = getMockDBConnection();
      const searchFeatureService = new SearchFeatureService(mockDBConnection);

      sinon.stub(SearchFeatureRepository.prototype, 'searchFeaturesByFiltersCount').resolves(3);

      const result = await searchFeatureService.getSearchFeaturesCount({ feature_types: ['dataset'] });

      expect(result).to.equal(3);
    });

    it('should return count for property filters', async () => {
      const mockDBConnection = getMockDBConnection();
      const searchFeatureService = new SearchFeatureService(mockDBConnection);

      sinon.stub(SearchFeatureRepository.prototype, 'searchFeaturesByFiltersCount').resolves(2);

      const result = await searchFeatureService.getSearchFeaturesCount({
        properties: [
          {
            operand: 'and',
            conditions: [
              {
                name: 'status',
                operator: 'eq',
                value: 'active'
              }
            ]
          }
        ]
      });

      expect(result).to.equal(2);
    });

    it('should return zero when no matches found', async () => {
      const mockDBConnection = getMockDBConnection();
      const searchFeatureService = new SearchFeatureService(mockDBConnection);

      sinon.stub(SearchFeatureRepository.prototype, 'searchFeaturesByFiltersCount').resolves(0);

      const result = await searchFeatureService.getSearchFeaturesCount({ keyword: 'nonexistent' });

      expect(result).to.equal(0);
    });
  });

  describe('systemUserId threading', () => {
    it('searchFeatures should pass systemUserId through to repository', async () => {
      const mockDBConnection = getMockDBConnection();
      const searchFeatureService = new SearchFeatureService(mockDBConnection);

      const searchStub = sinon.stub(SearchFeatureRepository.prototype, 'searchFeaturesByFilters').resolves([]);

      await searchFeatureService.searchFeatures({ keyword: 'moose' }, undefined, 42);

      expect(searchStub).to.be.calledOnceWith({ keyword: 'moose' }, undefined, 42);
    });

    it('searchFeatures should pass null systemUserId through to repository', async () => {
      const mockDBConnection = getMockDBConnection();
      const searchFeatureService = new SearchFeatureService(mockDBConnection);

      const searchStub = sinon.stub(SearchFeatureRepository.prototype, 'searchFeaturesByFilters').resolves([]);

      await searchFeatureService.searchFeatures({ keyword: 'moose' }, undefined, null);

      expect(searchStub).to.be.calledOnceWith({ keyword: 'moose' }, undefined, null);
    });

    it('getSearchFeaturesCount should pass systemUserId through to repository', async () => {
      const mockDBConnection = getMockDBConnection();
      const searchFeatureService = new SearchFeatureService(mockDBConnection);

      const countStub = sinon.stub(SearchFeatureRepository.prototype, 'searchFeaturesByFiltersCount').resolves(5);

      await searchFeatureService.getSearchFeaturesCount({ keyword: 'moose' }, 42);

      expect(countStub).to.be.calledOnceWith({ keyword: 'moose' }, 42);
    });

    it('getSearchFeaturesCount should pass null systemUserId through to repository', async () => {
      const mockDBConnection = getMockDBConnection();
      const searchFeatureService = new SearchFeatureService(mockDBConnection);

      const countStub = sinon.stub(SearchFeatureRepository.prototype, 'searchFeaturesByFiltersCount').resolves(0);

      await searchFeatureService.getSearchFeaturesCount({ keyword: 'moose' }, null);

      expect(countStub).to.be.calledOnceWith({ keyword: 'moose' }, null);
    });
  });
});
