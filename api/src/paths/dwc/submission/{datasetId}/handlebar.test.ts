import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../../database/db';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import { getHandleBarsTemplateByDatasetId } from './handlebar';

chai.use(sinonChai);

describe('handlebar', () => {
  describe('get a handlebars template for a given datasetId', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should return template data object', async () => {
      const dbConnectionObj = getMockDBConnection();
      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.params = {
        datasetId: 'uuid'
      };

      const requestHandler = getHandleBarsTemplateByDatasetId();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockRes.statusValue).to.equal(200);
    });
  });
});
