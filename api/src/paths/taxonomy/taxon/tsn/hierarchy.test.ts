import Ajv from 'ajv';
import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { GET } from '.';
import * as db from '../../../../database/db';
import { ItisService } from '../../../../services/itis-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import { getHierarchyForTSNs } from './hierarchy';

chai.use(sinonChai);

describe('taxonomy/taxon/tsn/hierarchy', () => {
  describe('openapi schema', () => {
    const ajv = new Ajv();

    it('is valid openapi v3 schema', () => {
      expect(ajv.validateSchema(GET.apiDoc as unknown as object)).to.be.true;
    });
  });

  describe('getHierarchyForTSNs', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('returns an empty array if no species are found', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const getHierarchyForTSNsStub = sinon.stub(ItisService.prototype, 'getHierarchyForTSNs').resolves([]);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.query = {
        tsn: ['1', '2']
      };

      const requestHandler = getHierarchyForTSNs();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(getHierarchyForTSNsStub).to.have.been.calledWith([1, 2]);

      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql([]);
    });

    it('returns an array of species', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const mock1 = {
        tsn: 1,
        commonNames: ['something'],
        scientificName: 'string',
        hierarchy: [3, 2, 1]
      } as unknown as any;
      const mock2 = { tsn: '2', commonNames: [], scientificName: 'string', hierarchy: [3, 2] } as unknown as any;

      const getHierarchyForTSNsStub = sinon.stub(ItisService.prototype, 'getHierarchyForTSNs').resolves([mock1, mock2]);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.query = {
        tsn: ['1', '2']
      };

      const requestHandler = getHierarchyForTSNs();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(getHierarchyForTSNsStub).to.have.been.calledWith([1, 2]);

      expect(mockRes.jsonValue).to.eql([mock1, mock2]);
      expect(mockRes.statusValue).to.equal(200);
    });
  });
});
