import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../../database/db';
import { HTTPError } from '../../../../errors/http-error';
import { SubmissionService } from '../../../../services/submission-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import { getHandleBarsTemplateByDatasetId} from "./handlebar";

chai.use(sinonChai);

describe('handlebar', () => {
  describe('get a handlebars template for a given datasetId', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should return template data object', async () => {
      const dbConnectionObj = getMockDBConnection();
      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      sinon.stub(SubmissionService.prototype, 'getHandleBarsTemplateByDatasetId').resolves({header: "hedaer", details: "details"});

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.params = {
        datasetId: 'uuid'
      };

      const requestHandler = getHandleBarsTemplateByDatasetId()

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockRes.statusValue).to.equal(200);
    });

    it('catches and re-throws an error', async () => {
      const dbConnectionObj = getMockDBConnection();
      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      sinon
        .stub(SubmissionService.prototype, 'getHandleBarsTemplateByDatasetId')
        .rejects(new Error('a test error'));

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.params = {
        datasetId: 'abcd'
      };

      try {
        const requestHandler = getHandleBarsTemplateByDatasetId();

        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect((actualError as HTTPError).message).to.equal('a test error');
      }
    });
  });
});
