import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { HTTPError } from '../../../errors/http-error';
import { DarwinCoreService } from '../../../services/dwc-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import { DWCArchive } from '../../../utils/media/dwc/dwc-archive-file';

import * as fileUtils from '../../../utils/file-utils';
import * as db from '../../../database/db';
import * as create from './create';
import { SubmissionService } from '../../../services/submission-service';

chai.use(sinonChai);

describe('create', () => {
  describe('submitDataset', () => {
    afterEach(() => {
      sinon.restore();
    });

    const sampleReq = {
      keycloak_token: {},
      body: {
        media: 'test',
        data_package_id: 'uuid'
      },
      files: [({ something: 'file' } as unknown) as Express.Multer.File]
    } as any;

    const sampleRes = [{ occurrence_id: 1 }, { occurrence_id: 2 }];

    it('should throw an error when req.file is detected to be malicious', async () => {
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.files = sampleReq.files;
      mockReq.body = sampleReq.body;

      sinon.stub(fileUtils, 'scanFileForVirus').resolves(false);

      try {
        const requestHandler = create.submitDataset();

        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect((actualError as HTTPError).status).to.equal(400);
        expect((actualError as HTTPError).message).to.equal('Malicious content detected, upload cancelled');
      }
    });

    it('should throw an error when prepDWCArchive fails', async () => {
      const dbConnectionObj = getMockDBConnection();
      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.files = sampleReq.files;
      mockReq.body = sampleReq.body;

      sinon.stub(fileUtils, 'scanFileForVirus').resolves(true);
      sinon.stub(DarwinCoreService.prototype, 'prepDWCArchive').throws('error');

      try {
        const requestHandler = create.submitDataset();

        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        console.log('actualError:', actualError);

        expect((actualError as HTTPError).status).to.equal(400);
        expect((actualError as HTTPError).message).to.equal('error');
      }
    });

    it('should throw an error when insertSubmissionRecord insert fails', async () => {
      const dbConnectionObj = getMockDBConnection();
      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.files = sampleReq.files;
      mockReq.body = sampleReq.body;

      sinon.stub(fileUtils, 'scanFileForVirus').resolves(true);
      sinon
        .stub(DarwinCoreService.prototype, 'prepDWCArchive')
        .resolves(({ something: 'test' } as unknown) as DWCArchive);

      sinon.stub(SubmissionService.prototype, 'insertSubmissionRecord').resolves();

      try {
        const requestHandler = create.submitDataset();

        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        console.log('actualError:', actualError);

        expect((actualError as HTTPError).status).to.equal(400);
        expect((actualError as HTTPError).message).to.equal('Failed to insert submission record');
      }
    });

    it('scrapes subbmission file and uploads occurrences and returns 200 and occurrence ids on success', async () => {
      const dbConnectionObj = getMockDBConnection();
      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.params = sampleReq.params;

      sinon.stub(DarwinCoreService.prototype, 'scrapeAndUploadOccurrences').resolves(sampleRes);

      const requestHandler = create.submitDataset();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockRes.statusValue).to.equal(200);
      console.log(mockRes);

      expect(mockRes.jsonValue).to.equal(sampleRes);
    });
  });
});
