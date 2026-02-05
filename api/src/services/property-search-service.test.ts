import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';

import { PropertySearchRepository } from '../repositories/property-search-repository';
import { getMockDBConnection } from '../__mocks__/db';
import { PropertySearchService } from './property-search-service';
import { SearchPropertyResult } from './property-search-service.interface';

chai.use(sinonChai);

describe('PropertySearchService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('searchProperty', () => {
    it('should return grouped string and number property results', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new PropertySearchService(mockDBConnection);

      const mockStringResults: SearchPropertyResult[] = [
        { feature_property_id: 1, property_name: 'Length', relevancy_score: 1 }
      ];

      const mockNumberResults: SearchPropertyResult[] = [
        { feature_property_id: 2, property_name: 'Depth', relevancy_score: 1 }
      ];

      const stringStub = sinon
        .stub(PropertySearchRepository.prototype, 'searchStringProperties')
        .resolves(mockStringResults);

      const numberStub = sinon
        .stub(PropertySearchRepository.prototype, 'searchNumberProperties')
        .resolves(mockNumberResults);

      const result = await service.searchProperty({ keyword: 'test' });

      expect(stringStub).to.be.calledOnceWith({ keyword: 'test' }, undefined);
      expect(numberStub).to.be.calledOnceWith({ keyword: 'test' }, undefined);

      expect(result).to.eql({
        string: mockStringResults,
        number: mockNumberResults
      });
    });

    it('should return empty groups when no results found', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new PropertySearchService(mockDBConnection);

      sinon.stub(PropertySearchRepository.prototype, 'searchStringProperties').resolves([]);
      sinon.stub(PropertySearchRepository.prototype, 'searchNumberProperties').resolves([]);

      const result = await service.searchProperty({ keyword: 'none' });

      expect(result).to.eql({
        string: [],
        number: []
      });
    });

    it('should pass pagination options to repository methods', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new PropertySearchService(mockDBConnection);

      const pagination = { page: 2, limit: 10 };

      const stringStub = sinon.stub(PropertySearchRepository.prototype, 'searchStringProperties').resolves([]);

      const numberStub = sinon.stub(PropertySearchRepository.prototype, 'searchNumberProperties').resolves([]);

      await service.searchProperty({ keyword: 'test' }, pagination);

      expect(stringStub).to.be.calledOnceWith({ keyword: 'test' }, pagination);
      expect(numberStub).to.be.calledOnceWith({ keyword: 'test' }, pagination);
    });
  });

  describe('getSearchPropertyCount', () => {
    it('should return combined count from string and number properties', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new PropertySearchService(mockDBConnection);

      const stringCountStub = sinon.stub(PropertySearchRepository.prototype, 'searchStringPropertiesCount').resolves(5);

      const numberCountStub = sinon.stub(PropertySearchRepository.prototype, 'searchNumberPropertiesCount').resolves(3);

      const result = await service.getSearchPropertyCount({ keyword: 'test' });

      expect(stringCountStub).to.be.calledOnceWith({ keyword: 'test' });
      expect(numberCountStub).to.be.calledOnceWith({ keyword: 'test' });

      expect(result).to.equal(8);
    });

    it('should return 0 when both counts are 0', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new PropertySearchService(mockDBConnection);

      sinon.stub(PropertySearchRepository.prototype, 'searchStringPropertiesCount').resolves(0);
      sinon.stub(PropertySearchRepository.prototype, 'searchNumberPropertiesCount').resolves(0);

      const result = await service.getSearchPropertyCount({ keyword: 'none' });

      expect(result).to.equal(0);
    });
  });
});
