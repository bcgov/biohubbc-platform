import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../../database/db';
import { HTTPError } from '../../../../errors/http-error';
import { SubmissionService } from '../../../../services/submission-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import { getMetadataByDatasetId } from './get';

chai.use(sinonChai);

describe('get', () => {
  describe('dataset metadata (from the DB) by datasetId', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should return a valid submission record on success', async () => {
      const dbConnectionObj = getMockDBConnection();
      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      sinon
        .stub(SubmissionService.prototype, 'getSubmissionRecordSONByDatasetId')
        .resolves(`{id: 'a valid json string}`);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.params = {
        datasetId: 'abcd'
      };

      const requestHandler = getMetadataByDatasetId();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockRes.statusValue).to.equal(200);
    });

    describe('should throw an error when', () => {
      it('datasetId is missing', async () => {
        const dbConnectionObj = getMockDBConnection();
        sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

        sinon
          .stub(SubmissionService.prototype, 'getSubmissionRecordSONByDatasetId')
          .resolves(`{id: 'a valid json string}`);

        const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

        mockReq.params = {};

        try {
          const requestHandler = getMetadataByDatasetId();

          await requestHandler(mockReq, mockRes, mockNext);
          expect.fail();
        } catch (actualError) {
          expect((actualError as HTTPError).message).to.equal('Missing required path param: datasetId');
        }
      });

      it('any error occurs', async () => {
        const dbConnectionObj = getMockDBConnection();
        sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

        sinon.stub(SubmissionService.prototype, 'getSubmissionRecordSONByDatasetId').rejects(new Error('a test error'));

        const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

        mockReq.params = {
          datasetId: 'abcd'
        };

        try {
          const requestHandler = getMetadataByDatasetId();

          await requestHandler(mockReq, mockRes, mockNext);
          expect.fail();
        } catch (actualError) {
          expect((actualError as HTTPError).message).to.equal('a test error');
        }
      });
    });
  });
});
