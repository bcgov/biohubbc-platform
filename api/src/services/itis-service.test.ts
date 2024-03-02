import axios from 'axios';
import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiGeneralError } from '../errors/api-error';
import { ItisService } from './itis-service';

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
                commonNames: ['$commonNames'],
                kingdom: 'kingdom',
                name: 'name',
                parentTSN: 'parentTSN',
                scientificName: 'scientificName',
                tsn: '123',
                updateDate: 'updateDate',
                usage: 'usage'
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
          commonNames: 'commonNames',
          scientificName: 'scientificName'
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
                commonNames: ['$commonNames'],
                kingdom: 'kingdom',
                name: 'name',
                parentTSN: 'parentTSN',
                scientificName: 'scientificName',
                tsn: '123',
                updateDate: 'updateDate',
                usage: 'usage'
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
          commonNames: ['$commonNames'],
          kingdom: 'kingdom',
          name: 'name',
          parentTSN: 'parentTSN',
          scientificName: 'scientificName',
          tsn: '123',
          updateDate: 'updateDate',
          usage: 'usage'
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
        'https://services.itis.gov/?wt=json&sort=nameWOInd+asc&rows=25&omitHeader=true&fl=tsn+scientificName:nameWOInd+kingdom+parentTSN+commonNames:vernacular+updateDate+usage&q=((nameWOInd:*term*+AND+usage:/(valid|accepted)/)+OR+(vernacular:*term*+AND+usage:/(valid|accepted)/))'
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
        'https://services.itis.gov/??wt=json&sort=nameWOInd+asc&rows=25&omitHeader=true&fl=tsn+scientificName:nameWOInd+kingdom+parentTSN+commonNames:vernacular+updateDate+usage&&q=tsn:123'
      );
    });
  });
});
