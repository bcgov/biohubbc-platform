import axios from 'axios';
import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiGeneralError } from '../errors/api-error';
import { ItisService, ItisSolrSearchResponseHierarchy } from './itis-service';

chai.use(sinonChai);

describe('ItisService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('searchItisByTerm', async () => {
    it('searches itis by term and returns empty when no term recognized', async () => {
      const mockAxiosResponse = {
        data: {}
      };

      const getItisSolrTermSearchUrlStub = sinon
        .stub(ItisService.prototype, 'getItisSolrTermSearchUrl')
        .resolves('url');

      const axiosStub = sinon.stub(axios, 'get').resolves(mockAxiosResponse);

      const itisService = new ItisService();

      const response = await itisService.searchItisByTerm(['term']);

      expect(response).to.eql([]);

      expect(axiosStub).to.have.been.calledWith('url');
      expect(getItisSolrTermSearchUrlStub).to.have.been.calledWith(['term']);
    });

    it('searches itis by term and returns list of docs', async () => {
      const mockAxiosResponse = {
        data: {
          response: {
            docs: [
              {
                commonNames: ['$commonNames$English'],
                kingdom: 'kingdom',
                name: 'name',
                parentTSN: 'parentTSN',
                scientificName: 'scientificName',
                tsn: '123',
                updateDate: 'updateDate',
                usage: '',
                rank: 'kingdom'
              }
            ]
          }
        }
      };

      const getItisSolrTermSearchUrlStub = sinon
        .stub(ItisService.prototype, 'getItisSolrTermSearchUrl')
        .resolves('url');

      const axiosStub = sinon.stub(axios, 'get').resolves(mockAxiosResponse);

      const itisService = new ItisService();

      const response = await itisService.searchItisByTerm(['term']);

      expect(response).to.eql([
        {
          tsn: 123,
          commonNames: ['commonNames'],
          scientificName: 'scientificName',
          rank: 'kingdom',
          kingdom: 'kingdom'
        }
      ]);

      expect(axiosStub).to.have.been.calledWith('url');
      expect(getItisSolrTermSearchUrlStub).to.have.been.calledWith(['term']);
    });

    it('catches and re-throws an error', async () => {
      sinon.stub(axios, 'get').rejects(new Error('a test error'));

      const itisService = new ItisService();
      const getItisSolrTermSearchUrlStub = sinon
        .stub(ItisService.prototype, 'getItisSolrTermSearchUrl')
        .resolves('url');

      try {
        await itisService.searchItisByTerm(['term']);

        expect.fail();
      } catch (error) {
        expect((error as ApiGeneralError).message).to.equal('a test error');
        expect(getItisSolrTermSearchUrlStub).to.have.been.calledWith(['term']);
      }
    });
  });

  describe('searchItisByTSN', async () => {
    it('searches itis by tsn and returns empty when no tsn recognized', async () => {
      const mockAxiosResponse = {
        data: {}
      };

      const getItisSolrTsnSearchUrlStub = sinon.stub(ItisService.prototype, 'getItisSolrTsnSearchUrl').resolves('url');

      const axiosStub = sinon.stub(axios, 'get').resolves(mockAxiosResponse);

      const itisService = new ItisService();

      const response = await itisService.searchItisByTSN([123]);

      expect(response).to.eql([]);

      expect(axiosStub).to.have.been.calledWith('url');
      expect(getItisSolrTsnSearchUrlStub).to.have.been.calledWith([123]);
    });

    it('searches itis by tsn and returns list of docs', async () => {
      const mockAxiosResponse = {
        data: {
          response: {
            docs: [
              {
                commonNames: ['$commonNames$English'],
                kingdom: 'kingdom',
                name: 'name',
                parentTSN: 'parentTSN',
                scientificName: 'scientificName',
                tsn: '123',
                updateDate: 'updateDate',
                usage: '',
                rank: 'kingdom'
              }
            ]
          }
        }
      };

      const getItisSolrTsnSearchUrlStub = sinon.stub(ItisService.prototype, 'getItisSolrTsnSearchUrl').resolves('url');

      const axiosStub = sinon.stub(axios, 'get').resolves(mockAxiosResponse);

      const itisService = new ItisService();

      const response = await itisService.searchItisByTSN([123]);

      expect(response).to.eql([
        {
          commonNames: ['$commonNames$English'],
          kingdom: 'kingdom',
          name: 'name',
          parentTSN: 'parentTSN',
          scientificName: 'scientificName',
          tsn: '123',
          updateDate: 'updateDate',
          usage: '',
          rank: 'kingdom'
        }
      ]);

      expect(axiosStub).to.have.been.calledWith('url');
      expect(getItisSolrTsnSearchUrlStub).to.have.been.calledWith([123]);
    });

    it('catches and re-throws an error', async () => {
      sinon.stub(axios, 'get').rejects(new Error('a test error'));

      const itisService = new ItisService();
      const getItisSolrTsnSearchUrlStub = sinon.stub(ItisService.prototype, 'getItisSolrTsnSearchUrl').resolves('url');

      try {
        await itisService.searchItisByTSN([123]);

        expect.fail();
      } catch (error) {
        expect((error as ApiGeneralError).message).to.equal('a test error');
        expect(getItisSolrTsnSearchUrlStub).to.have.been.calledWith([123]);
      }
    });
  });

  describe('getHierarchyForTSNs', async () => {
    it('returns array of hierarchy objects for tsns', async () => {
      const mockTsns = [1, 2];
      const mockTsnHierarchies = [
        { tsn: mockTsns[0], hierarchyTSN: ['$3$2$1$'] },
        { tsn: mockTsns[1], hierarchyTSN: ['$3$2$'] }
      ];
      const mockAxiosResponse = {
        data: {
          response: {
            docs: mockTsnHierarchies
          }
        }
      };

      const getItisSolrTsnHierarchyUrlStub = sinon
        .stub(ItisService.prototype, 'getItisSolrTsnHierarchyUrl')
        .returns('url');

      const axiosStub = sinon.stub(axios, 'get').resolves(mockAxiosResponse);

      const itisService = new ItisService();

      const response = await itisService.getHierarchyForTSNs(mockTsns);

      expect(getItisSolrTsnHierarchyUrlStub).to.have.been.calledWith(mockTsns);
      expect(axiosStub).to.have.been.calledWith('url');
      expect(response).to.eql([
        {
          tsn: mockTsns[0],
          hierarchy: [3, 2, 1]
        },
        {
          tsn: mockTsns[1],
          hierarchy: [3, 2]
        }
      ]);
    });

    it('catches and re-throws an error', async () => {
      const mockTsns = [1, 2];
      sinon.stub(axios, 'get').rejects(new Error('a test error'));

      const itisService = new ItisService();
      const getItisSolrTsnHierarchyUrlStub = sinon
        .stub(ItisService.prototype, 'getItisSolrTsnHierarchyUrl')
        .resolves('url');

      try {
        await itisService.getHierarchyForTSNs(mockTsns);

        expect.fail();
      } catch (error) {
        expect((error as ApiGeneralError).message).to.equal('a test error');
        expect(getItisSolrTsnHierarchyUrlStub).to.have.been.calledWith(mockTsns);
      }
    });
  });

  describe('getItisSolrTermSearchUrl', () => {
    it('throws an error when itis solr url is not set', async () => {
      process.env.ITIS_SOLR_URL = '';

      const itisService = new ItisService();

      try {
        await itisService.getItisSolrTermSearchUrl(['term']);

        expect.fail();
      } catch (error) {
        expect((error as ApiGeneralError).message).to.equal('Failed to build ITIS query.');
      }
    });

    it('returns a valid url', async () => {
      process.env.ITIS_SOLR_URL = 'https://services.itis.gov/';

      const itisService = new ItisService();

      const response = await itisService.getItisSolrTermSearchUrl(['term']);

      expect(response).to.equal(
        'https://services.itis.gov/?wt=json&sort=kingdom+asc&rows=150&omitHeader=true&fl=tsn+scientificName:nameWOInd+kingdom+parentTSN+commonNames:vernacular+updateDate+usage+rank&q=((nameWOInd:*term*+AND+usage:/(valid|accepted)/)+OR+(vernacular:*term*+AND+usage:/(valid|accepted)/))'
      );
    });
  });

  describe('getItisSolrTsnHierarchyUrl', () => {
    const mockTsns = [1];
    it('throws an error when itis solr url is not set', async () => {
      process.env.ITIS_SOLR_URL = '';

      const itisService = new ItisService();

      try {
        await itisService.getItisSolrTsnHierarchyUrl(mockTsns);

        expect.fail();
      } catch (error) {
        expect((error as ApiGeneralError).message).to.equal('Failed to build ITIS query.');
      }
    });

    it('returns a valid url', async () => {
      process.env.ITIS_SOLR_URL = 'https://services.itis.gov/';

      const itisService = new ItisService();

      const response = await itisService.getItisSolrTsnHierarchyUrl(mockTsns);

      expect(response).to.equal(
        'https://services.itis.gov/??wt=json&sort=kingdom+asc&rows=150&omitHeader=true&fl=tsn+hierarchyTSN&&q=tsn:1'
      );
    });
  });

  describe('getItisSolrTsnSearchUrl', () => {
    it('throws an error when itis solr url is not set', async () => {
      process.env.ITIS_SOLR_URL = '';

      const itisService = new ItisService();

      try {
        await itisService.getItisSolrTsnSearchUrl([123]);

        expect.fail();
      } catch (error) {
        expect((error as ApiGeneralError).message).to.equal('Failed to build ITIS query.');
      }
    });

    it('returns a valid url', async () => {
      process.env.ITIS_SOLR_URL = 'https://services.itis.gov/';

      const itisService = new ItisService();

      const response = await itisService.getItisSolrTsnSearchUrl([123]);

      expect(response).to.equal(
        'https://services.itis.gov/??wt=json&sort=kingdom+asc&rows=150&omitHeader=true&fl=tsn+scientificName:nameWOInd+kingdom+parentTSN+commonNames:vernacular+updateDate+usage+rank&&q=tsn:123'
      );
    });
  });

  describe('getItisSolrTsnSearchUrl', () => {
    it('throws an error when itis solr url is not set', async () => {
      process.env.ITIS_SOLR_URL = '';

      const itisService = new ItisService();

      try {
        await itisService.getItisSolrTsnSearchUrl([123]);

        expect.fail();
      } catch (error) {
        expect((error as ApiGeneralError).message).to.equal('Failed to build ITIS query.');
      }
    });

    it('returns a valid url', async () => {
      process.env.ITIS_SOLR_URL = 'https://services.itis.gov/';

      const itisService = new ItisService();

      const response = await itisService.getItisSolrTsnSearchUrl([123]);

      expect(response).to.equal(
        'https://services.itis.gov/??wt=json&sort=kingdom+asc&rows=150&omitHeader=true&fl=tsn+scientificName:nameWOInd+kingdom+parentTSN+commonNames:vernacular+updateDate+usage+rank&&q=tsn:123'
      );
    });
  });

  describe('_sanitizeHierarchyData', () => {
    it('turns an ITIS hierarchy string into an array'),
      () => {
        const mockData: ItisSolrSearchResponseHierarchy[] = [{ tsn: '1', hierarchyTSN: ['$3$2$1$'] }];

        const itisService = new ItisService();

        const result = itisService._sanitizeHierarchyData(mockData);

        expect(result).to.eql([3, 2, 1]);
      };
  });
});
