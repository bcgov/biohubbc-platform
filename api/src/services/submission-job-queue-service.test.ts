import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import {
  ISubmissionJobQueueRecord,
  SubmissionJobQueueRepository
} from '../repositories/submission-job-queue-repository';
import * as FileUtils from '../utils/file-utils';
import { getMockDBConnection } from '../__mocks__/db';
import { SubmissionJobQueueService } from './submission-job-queue-service';

chai.use(sinonChai);

describe('SubmissionJobQueueService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('createQueueJob', () => {
    it('should run without issue', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new SubmissionJobQueueService(mockDBConnection);
      const repo = sinon.stub(SubmissionJobQueueRepository.prototype, 'insertJobQueueRecord').resolves({ queue_id: 1 });

      const response = await service.createQueueJob(1, 1, '', {
        first_nations_id: 1,
        proprietor_type_id: 1,
        survey_id: 1,
        rational: '',
        proprietor_name: 1,
        disa_required: false
      });
      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql({ queue_id: 1 });
    });
  });

  describe('uploadDatasetToS3', () => {
    it('should create key and upload to S3', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new SubmissionJobQueueService(mockDBConnection);
      sinon.stub(FileUtils, 'uploadFileToS3');

      const uuid = 'uuid';
      const queueId = 1;
      const fileName = 'file name.zip';
      const key = await service.uploadDatasetToS3(uuid, queueId, {
        originalname: fileName
      } as unknown as Express.Multer.File);
      expect(key).to.be.eql('biohub/queue/1/datasets/uuid/dwca/file name.zip');
    });
  });

  describe('getNextUnprocessedJobQueueRecords', () => {
    it('should return an transform ID', async () => {
      const mockDBConnection = getMockDBConnection();

      const repo = sinon
        .stub(SubmissionJobQueueRepository.prototype, 'getNextUnprocessedJobQueueRecords')
        .resolves([
          { submission_job_queue_id: 1 },
          { submission_job_queue_id: 2 },
          { submission_job_queue_id: 3 }
        ] as unknown as ISubmissionJobQueueRecord[]);

      const service = new SubmissionJobQueueService(mockDBConnection);
      const response = await service.getNextUnprocessedJobQueueRecords(1);

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql([
        { submission_job_queue_id: 1 },
        { submission_job_queue_id: 2 },
        { submission_job_queue_id: 3 }
      ]);
    });
  });

  describe('startQueueRecord', () => {
    it('should return an transform ID', async () => {
      const mockDBConnection = getMockDBConnection();

      const repo = sinon.stub(SubmissionJobQueueRepository.prototype, 'startQueueRecord').resolves();

      const service = new SubmissionJobQueueService(mockDBConnection);
      const response = await service.startQueueRecord(1);

      expect(repo).to.be.calledOnce;
      expect(response).to.be.undefined;
    });
  });

  describe('endJobQueueRecord', () => {
    it('should return an transform ID', async () => {
      const mockDBConnection = getMockDBConnection();

      const repo = sinon.stub(SubmissionJobQueueRepository.prototype, 'endJobQueueRecord').resolves();

      const service = new SubmissionJobQueueService(mockDBConnection);
      const response = await service.endJobQueueRecord(1);

      expect(repo).to.be.calledOnce;
      expect(response).to.be.undefined;
    });
  });

  describe('resetJobQueueRecord', () => {
    it('should return an transform ID', async () => {
      const mockDBConnection = getMockDBConnection();

      const repo = sinon.stub(SubmissionJobQueueRepository.prototype, 'resetJobQueueRecord').resolves();

      const service = new SubmissionJobQueueService(mockDBConnection);
      const response = await service.resetJobQueueRecord(1);

      expect(repo).to.be.calledOnce;
      expect(response).to.be.undefined;
    });
  });

  describe('incrementAttemptCount', () => {
    it('should increment attempt count', async () => {
      const mockDBConnection = getMockDBConnection();

      const repo = sinon.stub(SubmissionJobQueueRepository.prototype, 'incrementAttemptCount').resolves();

      const service = new SubmissionJobQueueService(mockDBConnection);
      const response = await service.incrementAttemptCount(1);

      expect(repo).to.be.calledOnce;
      expect(response).to.be.undefined;
    });
  });
});
