import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getRequestHandlerMocks } from '../../__mocks__/db';
import { VirusScanQueueService } from '../../services/virus-scan-queue-service';
import * as jobs from './jobs';

chai.use(sinonChai);

describe('virus-scan/jobs', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('enqueueVirusScanJob', () => {
    it('returns 200 when job is enqueued', async () => {
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.body = { fileKey: 's3://bucket/key', bucket: 'bucket', fileName: 'file.txt' };

      const enqueueStub = sinon
        .stub(VirusScanQueueService.prototype, 'enqueue')
        .resolves({ jobId: 'abc', queue: 'virus-scan' });

      const requestHandler = jobs.enqueueVirusScanJob();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(enqueueStub).to.have.been.calledOnceWith({
        fileKey: 's3://bucket/key',
        bucket: 'bucket',
        fileName: 'file.txt',
        metadata: undefined
      });
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql({ job_id: 'abc', queue: 'virus-scan' });
    });

    it('throws an error when fileKey is missing', async () => {
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.body = {};

      const requestHandler = jobs.enqueueVirusScanJob();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        expect((error as Error).message).to.equal('Missing required `fileKey`');
      }
    });
  });
});
