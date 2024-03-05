import Ajv from 'ajv';
import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { findTaxonBySearchTerms, GET } from '.';
import * as db from '../../../database/db';
import { HTTPError } from '../../../errors/http-error';
import { ItisService } from '../../../services/itis-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';

chai.use(sinonChai);

describe('taxon', () => {
  describe('openapi schema', () => {
    const ajv = new Ajv();

    it('is valid openapi v3 schema', () => {
      expect(ajv.validateSchema(GET.apiDoc as unknown as object)).to.be.true;
    });
  });

  describe('findTaxonBySearchTerms', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('returns an empty array if no species are found', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const getSpeciesFromIdsStub = sinon.stub(ItisService.prototype, 'searchItisByTerm').resolves([]);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.query = {
        terms: ''
      };

      const requestHandler = findTaxonBySearchTerms();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(getSpeciesFromIdsStub).to.have.been.calledWith('');

      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql({ searchResponse: [] });
    });

    it('returns an array of species', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const mock1 = { id: '1', commonNames: ['something'], scientificName: 'string' } as unknown as any;
      const mock2 = { id: '2', commonNames: null, scientificName: 'string' } as unknown as any;

      const getSpeciesFromIdsStub = sinon.stub(ItisService.prototype, 'searchItisByTerm').resolves([mock1, mock2]);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.query = {
        terms: 't'
      };

      const requestHandler = findTaxonBySearchTerms();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(getSpeciesFromIdsStub).to.have.been.calledWith('t');

      expect(mockRes.jsonValue).to.eql({ searchResponse: [mock1, mock2] });
      expect(mockRes.statusValue).to.equal(200);
    });

    it('catches error, and re-throws error', async () => {
      const dbConnectionObj = getMockDBConnection({ rollback: sinon.stub(), release: sinon.stub() });

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      sinon.stub(ItisService.prototype, 'searchItisByTerm').rejects(new Error('a test error'));

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.query = {
        ids: 'a'
      };

      try {
        const requestHandler = findTaxonBySearchTerms();

        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect((actualError as HTTPError).message).to.equal('a test error');
      }
    });
  });
});
