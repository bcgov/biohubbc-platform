import Ajv from 'ajv';
import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { GET, getTaxonByTSN } from '.';
import * as db from '../../../../database/db';
import { HTTPError } from '../../../../errors/http-error';
import { TaxonomyService } from '../../../../services/taxonomy-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';

chai.use(sinonChai);

describe('tsn', () => {
  describe('openapi schema', () => {
    const ajv = new Ajv();

    it('is valid openapi v3 schema', () => {
      expect(ajv.validateSchema(GET.apiDoc as unknown as object)).to.be.true;
    });
  });

  describe('getTaxonByTSN', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('returns an empty array if no species are found', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const getTaxonByTsnIdsStub = sinon.stub(TaxonomyService.prototype, 'getTaxonByTsnIds').resolves([]);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.query = {
        tsn: ['1', '2']
      };

      const requestHandler = getTaxonByTSN();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(getTaxonByTsnIdsStub).to.have.been.calledWith([1, 2]);

      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql({ searchResponse: [] });
    });

    it('returns an array of species', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const mock1 = { tsn: '1', commonNames: ['something'], scientificName: 'string' } as unknown as any;
      const mock2 = { tsn: '2', commonNames: [], scientificName: 'string' } as unknown as any;

      const getTaxonByTsnIdsStub = sinon.stub(TaxonomyService.prototype, 'getTaxonByTsnIds').resolves([mock1, mock2]);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.query = {
        tsn: ['1', '2']
      };

      const requestHandler = getTaxonByTSN();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(getTaxonByTsnIdsStub).to.have.been.calledWith([1, 2]);

      expect(mockRes.jsonValue).to.eql({ searchResponse: [mock1, mock2] });
      expect(mockRes.statusValue).to.equal(200);
    });

    it('catches error, and re-throws error', async () => {
      const dbConnectionObj = getMockDBConnection({ rollback: sinon.stub(), release: sinon.stub() });

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      sinon.stub(TaxonomyService.prototype, 'getTaxonByTsnIds').rejects(new Error('a test error'));

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.query = {
        tsn: ['1', '2']
      };

      try {
        const requestHandler = getTaxonByTSN();

        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect((actualError as HTTPError).message).to.equal('a test error');
      }
    });
  });
});
