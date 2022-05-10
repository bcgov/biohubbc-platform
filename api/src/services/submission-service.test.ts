import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import {
  IInsertSubmissionRecord,
  ISubmissionModel,
  SubmissionRepository,
  SUBMISSION_MESSAGE_TYPE,
  SUBMISSION_STATUS_TYPE
} from '../repositories/submission-repository';
import { getMockDBConnection } from '../__mocks__/db';
import { SubmissionService } from './submission-service';

chai.use(sinonChai);

describe('SubmissionService', () => {
  describe('insertSubmissionRecord', () => {
    it('should return submission_id on insert', async () => {
      const mockDBConnection = getMockDBConnection();
      const submissionService = new SubmissionService(mockDBConnection);

      const repo = sinon.stub(SubmissionRepository.prototype, 'insertSubmissionRecord').resolves({ submission_id: 1 });

      const response = await submissionService.insertSubmissionRecord(({} as unknown) as IInsertSubmissionRecord);

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql({ submission_id: 1 });
    });
  });

  describe('updateSubmissionRecordInputKey', () => {
    it('should return submission_id on update', async () => {
      const mockDBConnection = getMockDBConnection();
      const submissionService = new SubmissionService(mockDBConnection);

      const repo = sinon
        .stub(SubmissionRepository.prototype, 'updateSubmissionRecordInputKey')
        .resolves({ submission_id: 1 });

      const response = await submissionService.updateSubmissionRecordInputKey(1, 'test');

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql({ submission_id: 1 });
    });
  });

  describe('getSubmissionRecordBySubmissionId', () => {
    it('should return submission row object', async () => {
      const mockDBConnection = getMockDBConnection();
      const submissionService = new SubmissionService(mockDBConnection);

      const repo = sinon
        .stub(SubmissionRepository.prototype, 'getSubmissionRecordBySubmissionId')
        .resolves(({ submission_id: 1 } as unknown) as ISubmissionModel);

      const response = await submissionService.getSubmissionRecordBySubmissionId(1);

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql({ submission_id: 1 });
    });
  });

  describe('insertSubmissionStatus', () => {
    it('should return submission status data', async () => {
      const mockDBConnection = getMockDBConnection();
      const submissionService = new SubmissionService(mockDBConnection);

      const repo = sinon
        .stub(SubmissionRepository.prototype, 'insertSubmissionStatus')
        .resolves({ submission_status_id: 1, submission_status_type_id: 1 });

      const response = await submissionService.insertSubmissionStatus(1, SUBMISSION_STATUS_TYPE.SUBMITTED);

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql({ submission_status_id: 1, submission_status_type_id: 1 });
    });
  });

  describe('insertSubmissionMessage', () => {
    it('should return submission message data', async () => {
      const mockDBConnection = getMockDBConnection();
      const submissionService = new SubmissionService(mockDBConnection);

      const repo = sinon
        .stub(SubmissionRepository.prototype, 'insertSubmissionMessage')
        .resolves({ submission_message_id: 1, submission_message_type_id: 1 });

      const response = await submissionService.insertSubmissionMessage(1, SUBMISSION_MESSAGE_TYPE.DUPLICATE_HEADER);

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql({ submission_message_id: 1, submission_message_type_id: 1 });
    });
  });
});
