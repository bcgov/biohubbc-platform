import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiGeneralError } from '../errors/api-error';
import {
  IInsertSubmissionRecord,
  ISearchSubmissionCriteria,
  ISourceTransformModel,
  ISubmissionModel,
  SubmissionRepository,
  SUBMISSION_MESSAGE_TYPE,
  SUBMISSION_STATUS_TYPE
} from '../repositories/submission-repository';
import * as FileUtils from '../utils/file-utils';
import { getMockDBConnection } from '../__mocks__/db';
import { SubmissionService } from './submission-service';

chai.use(sinonChai);

describe('SubmissionService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('findSubmissionByCriteria', () => {
    it('should return array of submission_id on call', async () => {
      const mockDBConnection = getMockDBConnection();
      const submissionService = new SubmissionService(mockDBConnection);

      const repo = sinon
        .stub(SubmissionRepository.prototype, 'findSubmissionByCriteria')
        .resolves([{ submission_id: 1 }]);

      const response = await submissionService.findSubmissionByCriteria({} as unknown as ISearchSubmissionCriteria);

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql([{ submission_id: 1 }]);
    });
  });

  describe('insertSubmissionRecord', () => {
    it('should return submission_id on insert', async () => {
      const mockDBConnection = getMockDBConnection();
      const submissionService = new SubmissionService(mockDBConnection);

      const repo = sinon.stub(SubmissionRepository.prototype, 'insertSubmissionRecord').resolves({ submission_id: 1 });

      const response = await submissionService.insertSubmissionRecord({} as unknown as IInsertSubmissionRecord);

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
        .resolves({ submission_id: 1 } as unknown as ISubmissionModel);

      const response = await submissionService.getSubmissionRecordBySubmissionId(1);

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql({ submission_id: 1 });
    });
  });

  describe('getSourceTransformRecordBySystemUserId', () => {
    it('should return submission source transform row object', async () => {
      const mockDBConnection = getMockDBConnection();
      const submissionService = new SubmissionService(mockDBConnection);

      const repo = sinon
        .stub(SubmissionRepository.prototype, 'getSourceTransformRecordBySystemUserId')
        .resolves({ source_transform_id: 1 } as unknown as ISourceTransformModel);

      const response = await submissionService.getSourceTransformRecordBySystemUserId(1);

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql({ source_transform_id: 1 });
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

      const response = await submissionService.insertSubmissionMessage(
        1,
        SUBMISSION_MESSAGE_TYPE.DUPLICATE_HEADER,
        'some message'
      );

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql({ submission_message_id: 1, submission_message_type_id: 1 });
    });
  });

  describe('listSubmissionRecords', () => {
    it('should return submission message data', async () => {
      const mockDBConnection = getMockDBConnection();
      const submissionService = new SubmissionService(mockDBConnection);
      const mockResponse = [
        {
          submission_status: 'Submission Data Ingested',
          submission_id: 1,
          source_transform_id: 'SIMS',
          uuid: '2267501d-c6a9-43b5-b951-2324faff6397',
          event_timestamp: '2022-05-24T18:41:42.211Z',
          delete_timestamp: null,
          input_key: 'platform/1/moose_aerial_stratifiedrandomblock_composition_recruitment_survey_2.5_withdata.zip',
          input_file_name: 'moose_aerial_stratifiedrandomblock_composition_recruitment_survey_2.5_withdata.zip',
          eml_source: null,
          darwin_core_source: 'test',
          create_date: '2022-05-24T18:41:42.056Z',
          create_user: 15,
          update_date: '2022-05-24T18:41:42.056Z',
          update_user: 15,
          revision_count: 1
        }
      ];

      const repo = sinon.stub(SubmissionRepository.prototype, 'listSubmissionRecords').resolves(mockResponse);

      const response = await submissionService.listSubmissionRecords();

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql(mockResponse);
    });
  });

  describe('getEMLStyleSheetKey', () => {
    it('should throw an error if no styleSheetKey available', async () => {
      const mockDBConnection = getMockDBConnection();
      const submissionService = new SubmissionService(mockDBConnection);
      const mockResponse = { transform_precompile_key: '' } as unknown as ISourceTransformModel;

      const repo = sinon
        .stub(SubmissionRepository.prototype, 'getSourceTransformRecordBySubmissionId')
        .resolves(mockResponse);

      try {
        await submissionService.getEMLStyleSheetKey(1);
        expect.fail();
      } catch (actualError) {
        expect(repo).to.be.calledOnce;

        expect((actualError as ApiGeneralError).message).to.equal('Failed to retrieve stylesheet key');
      }
    });

    it('should return S3key', async () => {
      const mockDBConnection = getMockDBConnection();
      const submissionService = new SubmissionService(mockDBConnection);
      const mockResponse = { transform_precompile_key: 's3key_return' } as unknown as ISourceTransformModel;

      const repo = sinon
        .stub(SubmissionRepository.prototype, 'getSourceTransformRecordBySubmissionId')
        .resolves(mockResponse);

      const response = await submissionService.getEMLStyleSheetKey(1);

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql('s3key_return');
    });
  });

  describe('getStylesheetFromS3', () => {
    it('should throw an error if file could not be fetched from s3', async () => {
      const mockDBConnection = getMockDBConnection();
      const submissionService = new SubmissionService(mockDBConnection);

      const service = sinon.stub(SubmissionService.prototype, 'getEMLStyleSheetKey').resolves('validString');
      sinon.stub(FileUtils, 'getFileFromS3').resolves();

      try {
        await submissionService.getStylesheetFromS3(1);
        expect.fail();
      } catch (actualError) {
        expect(service).to.be.calledOnce;
        expect((actualError as ApiGeneralError).message).to.equal('Failed to get file from S3');
      }
    });

    it('should return s3 file', async () => {
      const mockDBConnection = getMockDBConnection();
      const submissionService = new SubmissionService(mockDBConnection);

      const service = sinon.stub(SubmissionService.prototype, 'getEMLStyleSheetKey').resolves('validString');
      sinon.stub(FileUtils, 'getFileFromS3').resolves({ Body: 'valid' });

      const response = await submissionService.getStylesheetFromS3(1);
      expect(service).to.be.calledOnce;
      expect(response).to.be.eql({ Body: 'valid' });
    });
  });

  describe('insertSubmissionStatusAndMessage', () => {
    it('should return submission status id and message id', async () => {
      const mockDBConnection = getMockDBConnection();
      const submissionService = new SubmissionService(mockDBConnection);

      const mockMessageResponse = { submission_message_id: 1, submission_message_type_id: 1 };
      const mockStatusResponse = { submission_status_id: 2, submission_status_type_id: 2 };

      const repoStatus = sinon
        .stub(SubmissionRepository.prototype, 'insertSubmissionStatus')
        .resolves(mockStatusResponse);

      const repoMessage = sinon
        .stub(SubmissionRepository.prototype, 'insertSubmissionMessage')
        .resolves(mockMessageResponse);

      const response = await submissionService.insertSubmissionStatusAndMessage(
        1,
        SUBMISSION_STATUS_TYPE.SUBMITTED,
        SUBMISSION_MESSAGE_TYPE.MISCELLANEOUS,
        'message'
      );
      expect(repoStatus).to.be.calledOnce;
      expect(repoMessage).to.be.calledOnce;
      expect(response).to.be.eql({
        submission_status_id: 2,
        submission_message_id: 1
      });
    });
  });

  describe('updateSubmissionRecordDWCSource', () => {
    it('should return submission id', async () => {
      const mockDBConnection = getMockDBConnection();
      const submissionService = new SubmissionService(mockDBConnection);

      const repo = sinon
        .stub(SubmissionRepository.prototype, 'updateSubmissionRecordDWCSource')
        .resolves({ submission_id: 1 });

      const response = await submissionService.updateSubmissionRecordDWCSource(1, 'string');

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql({ submission_id: 1 });
    });
  });
});
