import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';

import { getMockDBConnection } from '../__mocks__/db';
import { PropertySearchRepository } from '../repositories/property-search-repository';
import { PropertySearchService } from './property-search-service';
import { SearchPropertyResult } from './property-search-service.interface';

chai.use(sinonChai);

describe('PropertySearchService', () => {
  const propertyResult = (overrides: Partial<SearchPropertyResult> = {}): SearchPropertyResult => ({
    feature_property_id: 1,
    property_name: 'length',
    property_display_name: 'Length',
    feature_property_type: 'string',
    operators: ['Equals', 'ILike', 'Exists'],
    relevancy_score: 1,
    ...overrides
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('searchProperty', () => {
    it('should return grouped property results', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new PropertySearchService(mockDBConnection);

      const mockResults: SearchPropertyResult[] = [
        propertyResult({ feature_property_type: 'string' }),
        propertyResult({
          feature_property_id: 2,
          property_name: 'depth',
          property_display_name: 'Depth',
          feature_property_type: 'number',
          operators: ['Equals', 'GreaterThan', 'Exists']
        }),
        propertyResult({
          feature_property_id: 3,
          property_name: 'survey_date',
          property_display_name: 'Survey date',
          feature_property_type: 'datetime',
          operators: ['Before', 'After', 'Exists']
        })
      ];

      const searchStub = sinon.stub(PropertySearchRepository.prototype, 'searchProperties').resolves(mockResults);

      const result = await service.searchProperty({ keyword: 'test' });

      expect(searchStub).to.be.calledOnceWith({ keyword: 'test' }, undefined);

      expect(result).to.eql({
        string: [mockResults[0]],
        number: [mockResults[1]],
        boolean: [],
        datetime: [mockResults[2]],
        taxon: [],
        spatial: [],
        code: []
      });
    });

    it('should return empty groups when no results found', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new PropertySearchService(mockDBConnection);

      sinon.stub(PropertySearchRepository.prototype, 'searchProperties').resolves([]);

      const result = await service.searchProperty({ keyword: 'none' });

      expect(result).to.eql({
        string: [],
        number: [],
        boolean: [],
        datetime: [],
        taxon: [],
        spatial: [],
        code: []
      });
    });

    it('should pass pagination options to repository methods', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new PropertySearchService(mockDBConnection);

      const pagination = { page: 2, limit: 10 };

      const searchStub = sinon.stub(PropertySearchRepository.prototype, 'searchProperties').resolves([]);

      await service.searchProperty({ keyword: 'test' }, pagination);

      expect(searchStub).to.be.calledOnceWith({ keyword: 'test' }, pagination);
    });
  });

  describe('getSearchPropertyCount', () => {
    it('should return property count', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new PropertySearchService(mockDBConnection);

      const countStub = sinon.stub(PropertySearchRepository.prototype, 'searchPropertiesCount').resolves(8);

      const result = await service.getSearchPropertyCount({ keyword: 'test' });

      expect(countStub).to.be.calledOnceWith({ keyword: 'test' });

      expect(result).to.equal(8);
    });

    it('should return 0 when both counts are 0', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new PropertySearchService(mockDBConnection);

      sinon.stub(PropertySearchRepository.prototype, 'searchPropertiesCount').resolves(0);

      const result = await service.getSearchPropertyCount({ keyword: 'none' });

      expect(result).to.equal(0);
    });
  });
});
