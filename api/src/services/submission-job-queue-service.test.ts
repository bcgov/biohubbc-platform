import { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as FileUtils from '../utils/file-utils';
import { SubmissionJobQueueRepository } from '../repositories/submission-job-queue-repository';
import { getMockDBConnection } from '../__mocks__/db';
import { SubmissionJobQueueService } from './submission-job-queue-service';
import { SubmissionService } from './submission-service';

chai.use(sinonChai);

describe.only('SubmissionJobQueueService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('createQueueJob', () => {
    it('should run without issue', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new SubmissionJobQueueService(mockDBConnection);
      const repo = sinon.stub(SubmissionJobQueueRepository.prototype, 'insertJobQueueRecord').resolves({ queue_id: 1 });

      const response = await service.createQueueJob(1, 1, {
        first_nations_id: 1,
        proprietor_type_id: 1,
        survey_id: 1,
        rational: '',
        proprietor_name: 1,
        disa_required: false
      });
      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql(1);
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
      const mockDBConnection = getMockDBConnection();
      const service = new SubmissionJobQueueService(mockDBConnection);

      const getQueue = sinon.stub(SubmissionJobQueueRepository.prototype, 'getNextQueueId').resolves({queueId: 1});
      const getSourceTransform = sinon.stub(SubmissionJobQueueService.prototype, 'getSourceTransformIdForUserId').resolves(1);
      const getSubmissionId = sinon.stub(SubmissionService.prototype, 'getSubmissionIdByUUID').resolves({submission_id: 1});
      const uploadToS3 = sinon.stub(SubmissionJobQueueService.prototype, 'uploadDatasetToS3').resolves("key");
      const createQueue = sinon.stub()

      const response = await service.intake("", {} as unknown as Express.Multer.File);

      
    });

    it('should return queue id and find submission', async () => {});
  });

  describe('uploadDatasetToS3', () => {
    it('should create key and upload to S3', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new SubmissionJobQueueService(mockDBConnection);
      sinon.stub(FileUtils, 'uploadFileToS3');

      const uuid = "uuid";
      const queueId = 1;
      const fileName = "file name.zip"
      const key = await service.uploadDatasetToS3(uuid, queueId, {originalName: fileName} as unknown as Express.Multer.File);
      
      expect(key).to.be.eql('datasets/uuid/dwca/1/file name.zip');
    });
  })
});
