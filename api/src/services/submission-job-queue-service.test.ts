import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { SubmissionJobQueueRepository } from '../repositories/submission-job-queue-repository';
import * as FileUtils from '../utils/file-utils';
import { getMockDBConnection } from '../__mocks__/db';
import { SubmissionJobQueueService } from './submission-job-queue-service';
import { SubmissionService } from './submission-service';

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

  describe('getSourceTransformIdForUserId', () => {
    it('should return an transform ID', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new SubmissionJobQueueService(mockDBConnection);
      const repo = sinon.stub(SubmissionJobQueueRepository.prototype, 'getSourceTransformIdForUserId').resolves(1);

      const response = await service.getSourceTransformIdForUserId(1);
      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql(1);
    });
  });

  describe('intake', () => {
    it('should return queue id and create new submission', async () => {
      const mockDBConnection = getMockDBConnection({
        systemUserId: () => {
          return 1;
        }
      });
      const service = new SubmissionJobQueueService(mockDBConnection);

      sinon.stub(SubmissionJobQueueRepository.prototype, 'getNextQueueId').resolves({ queueId: 1 });
      sinon.stub(SubmissionJobQueueService.prototype, 'getSourceTransformIdForUserId').resolves(3);
      sinon.stub(SubmissionService.prototype, 'getSubmissionIdByUUID').resolves(null);
      sinon.stub(SubmissionJobQueueService.prototype, 'uploadDatasetToS3').resolves('key');
      const insert = sinon.stub(SubmissionService.prototype, 'insertSubmissionRecord').resolves({ submission_id: 1 });
      sinon.stub(SubmissionJobQueueService.prototype, 'createQueueJob').resolves({ queue_id: 1 });
      sinon.stub(SubmissionService.prototype, 'insertSubmissionStatusAndMessage').resolves();

      const response = await service.intake('uuid', {} as unknown as Express.Multer.File);

      expect(response.queue_id).to.be.eql(1);
      expect(insert).to.be.calledOnce;
    });

    it('should return queue id and update submission', async () => {
      const mockDBConnection = getMockDBConnection({
        systemUserId: () => {
          return 1;
        }
      });
      const service = new SubmissionJobQueueService(mockDBConnection);

      sinon.stub(SubmissionJobQueueRepository.prototype, 'getNextQueueId').resolves({ queueId: 1 });
      sinon.stub(SubmissionJobQueueService.prototype, 'getSourceTransformIdForUserId').resolves(3);
      sinon.stub(SubmissionService.prototype, 'getSubmissionIdByUUID').resolves({ submission_id: 1 });
      sinon.stub(SubmissionJobQueueService.prototype, 'uploadDatasetToS3').resolves('key');
      const insert = sinon.stub(SubmissionService.prototype, 'insertSubmissionRecord').resolves({ submission_id: 1 });
      sinon.stub(SubmissionJobQueueService.prototype, 'createQueueJob').resolves({ queue_id: 1 });
      sinon.stub(SubmissionService.prototype, 'insertSubmissionStatusAndMessage').resolves();

      const response = await service.intake('uuid', {} as unknown as Express.Multer.File);

      expect(response.queue_id).to.be.eql(1);
      expect(insert).not.be.called;
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
      expect(key).to.be.eql('platform/datasets/uuid/dwca/1/file name.zip');
    });
  });
});
