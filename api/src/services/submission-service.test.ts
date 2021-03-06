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
import { EMLFile } from '../utils/media/eml/eml-file';
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

  describe('updateSubmissionRecordEMLSource', () => {
    it('should return submission_id on update', async () => {
      const mockDBConnection = getMockDBConnection();
      const submissionService = new SubmissionService(mockDBConnection);

      const repo = sinon
        .stub(SubmissionRepository.prototype, 'updateSubmissionRecordEMLSource')
        .resolves({ submission_id: 1 });

      const response = await submissionService.updateSubmissionRecordEMLSource(1, { emlFile: {} } as EMLFile);

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql({ submission_id: 1 });
    });
  });

  describe('updateSubmissionRecordEMLJSONSource', () => {
    it('should return submission_id on update', async () => {
      const mockDBConnection = getMockDBConnection();
      const submissionService = new SubmissionService(mockDBConnection);

      const repo = sinon
        .stub(SubmissionRepository.prototype, 'updateSubmissionRecordEMLJSONSource')
        .resolves({ submission_id: 1 });

      const response = await submissionService.updateSubmissionRecordEMLJSONSource(1, 'test');

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql({ submission_id: 1 });
    });
  });

  describe('getSubmissionRecordBySubmissionId', () => {
    it('should return submission_id on update', async () => {
      const mockDBConnection = getMockDBConnection();
      const submissionService = new SubmissionService(mockDBConnection);

      const repo = sinon
        .stub(SubmissionRepository.prototype, 'getSubmissionRecordBySubmissionId')
        .resolves({ test: 'test' } as unknown as ISubmissionModel);

      const response = await submissionService.getSubmissionRecordBySubmissionId(1);

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql({ test: 'test' });
    });
  });

  describe('getSubmissionIdByUUID', () => {
    it('should return submission_id on update', async () => {
      const mockDBConnection = getMockDBConnection();
      const submissionService = new SubmissionService(mockDBConnection);

      const repo = sinon.stub(SubmissionRepository.prototype, 'getSubmissionIdByUUID').resolves({ submission_id: 1 });

      const response = await submissionService.getSubmissionIdByUUID('test');

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql({ submission_id: 1 });
    });
  });

  describe('setSubmissionEndDateById', () => {
    it('should return submission_id on update', async () => {
      const mockDBConnection = getMockDBConnection();
      const submissionService = new SubmissionService(mockDBConnection);

      const repo = sinon
        .stub(SubmissionRepository.prototype, 'setSubmissionEndDateById')
        .resolves({ submission_id: 1 });

      const response = await submissionService.setSubmissionEndDateById(1);

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

  describe('getSubmissionMetadataJson', () => {
    it('should return submission source transform row object', async () => {
      const mockDBConnection = getMockDBConnection();
      const submissionService = new SubmissionService(mockDBConnection);

      const repo = sinon
        .stub(SubmissionRepository.prototype, 'getSubmissionMetadataJson')
        .resolves('transformed metadata');

      const response = await submissionService.getSubmissionMetadataJson(1, 'transform');

      expect(repo).to.be.calledOnce;
      expect(response).to.be.equal('transformed metadata');
    });
  });

  describe('getSourceTransformRecordBySourceTransformId', () => {
    it('should return submission source transform row object', async () => {
      const mockDBConnection = getMockDBConnection();
      const submissionService = new SubmissionService(mockDBConnection);

      const repo = sinon
        .stub(SubmissionRepository.prototype, 'getSourceTransformRecordBySourceTransformId')
        .resolves({ source_transform_id: 1 } as unknown as ISourceTransformModel);

      const response = await submissionService.getSourceTransformRecordBySourceTransformId(1);

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

      const response = await submissionService.insertSubmissionStatus(1, SUBMISSION_STATUS_TYPE.INGESTED);

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
        SUBMISSION_MESSAGE_TYPE.ERROR,
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
          source_transform_id: 1,
          uuid: '2267501d-c6a9-43b5-b951-2324faff6397',
          record_effective_date: '2022-05-24T18:41:42.211Z',
          record_end_date: null,
          input_key: 'platform/1/moose_aerial_stratifiedrandomblock_composition_recruitment_survey_2.5_withdata.zip',
          input_file_name: 'moose_aerial_stratifiedrandomblock_composition_recruitment_survey_2.5_withdata.zip',
          eml_source: null,
          eml_json_source: null,
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

  describe('getIntakeFileFromS3', () => {
    it('should throw an error if file does not contain input_key', async () => {
      const mockDBConnection = getMockDBConnection();
      const submissionService = new SubmissionService(mockDBConnection);

      const repo = sinon
        .stub(SubmissionRepository.prototype, 'getSubmissionRecordBySubmissionId')
        .resolves({ uuid: 'validString' } as ISubmissionModel);

      try {
        await submissionService.getIntakeFileFromS3(1);
        expect.fail();
      } catch (actualError) {
        expect(repo).to.be.calledOnce;
        expect((actualError as ApiGeneralError).message).to.equal('Failed to retrieve input file name');
      }
    });

    it('should return s3 file', async () => {
      const mockDBConnection = getMockDBConnection();
      const submissionService = new SubmissionService(mockDBConnection);

      const repo = sinon
        .stub(SubmissionRepository.prototype, 'getSubmissionRecordBySubmissionId')
        .resolves({ input_key: 'validString' } as ISubmissionModel);
      sinon.stub(SubmissionService.prototype, 'getFileFromS3').resolves({ Body: 'valid' });

      const response = await submissionService.getIntakeFileFromS3(1);
      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql({ Body: 'valid' });
    });
  });

  describe('getFileFromS3', () => {
    it('should throw an error if file could not be fetched from s3', async () => {
      const mockDBConnection = getMockDBConnection();
      const submissionService = new SubmissionService(mockDBConnection);

      const s3Stub = sinon.stub(FileUtils, 'getFileFromS3').resolves();

      try {
        await submissionService.getFileFromS3('fileName');
        expect.fail();
      } catch (actualError) {
        expect(s3Stub).to.be.calledOnce;
        expect((actualError as ApiGeneralError).message).to.equal('Failed to get file from S3');
      }
    });

    it('should return s3 file', async () => {
      const mockDBConnection = getMockDBConnection();
      const submissionService = new SubmissionService(mockDBConnection);

      const s3Stub = sinon.stub(FileUtils, 'getFileFromS3').resolves({ Body: 'valid' });

      const response = await submissionService.getFileFromS3('fileName');

      expect(s3Stub).to.be.calledOnce;
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
        SUBMISSION_STATUS_TYPE.FAILED_METADATA_TO_ES,
        SUBMISSION_MESSAGE_TYPE.ERROR,
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
