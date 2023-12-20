import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../database/db';
import { HTTPError } from '../errors/http-error';
import { CodeService } from '../services/code-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../__mocks__/db';
import * as codes from './codes';

chai.use(sinonChai);

describe('codes', () => {
  describe('getAllCodes', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw a 500 error when error occurs in api', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const requestHandler = codes.getAllCodes();

      const getAllCodeSetsStub = sinon.stub(CodeService.prototype, 'getAllCodeSets').resolves(undefined);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      try {
        await requestHandler(mockReq, mockRes, mockNext);

        expect.fail();
      } catch (error) {
        expect(getAllCodeSetsStub).to.have.been.calledOnce;
        expect((error as HTTPError).status).to.equal(500);
        expect((error as HTTPError).message).to.equal('Failed to fetch codes');
      }
    });

    it('should return 200 on success', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const requestHandler = codes.getAllCodes();

      const getAllCodeSetsStub = sinon
        .stub(CodeService.prototype, 'getAllCodeSets')
        .resolves({ feature_type_with_properties: [] });

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.query = { level: 'info' };

      await requestHandler(mockReq, mockRes, mockNext);

      expect(getAllCodeSetsStub).to.have.been.calledOnce;
      expect(mockRes.statusValue).to.eql(200);
      expect(mockRes.jsonValue).to.eql({ feature_type_with_properties: [] });
    });
  });
});
