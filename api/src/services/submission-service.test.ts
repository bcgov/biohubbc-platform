import chai, { expect } from 'chai';
import * as JSONPathPlus from 'jsonpath-plus';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiExecuteSQLError } from '../errors/api-error';
import { UserObject } from '../models/user';
import { SECURITY_APPLIED_STATUS } from '../repositories/security-repository';
import {
  ISourceTransformModel,
  ISubmissionJobQueueRecord,
  ISubmissionModel,
  ISubmissionObservationRecord,
  SubmissionRecord,
  SubmissionRepository,
  SubmissionWithSecurityRecord,
  SUBMISSION_MESSAGE_TYPE,
  SUBMISSION_STATUS_TYPE
} from '../repositories/submission-repository';
import { EMLFile } from '../utils/media/eml/eml-file';
import { getMockDBConnection } from '../__mocks__/db';
import { SubmissionService } from './submission-service';
import { UserService } from './user-service';

chai.use(sinonChai);

describe('SubmissionService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('insertSubmissionRecord', () => {
    it('should return submission_id on insert', async () => {
      const mockDBConnection = getMockDBConnection();
      const submissionService = new SubmissionService(mockDBConnection);

      const repo = sinon.stub(SubmissionRepository.prototype, 'insertSubmissionRecord').resolves({ submission_id: 1 });

      const response = await submissionService.insertSubmissionRecord({ uuid: '', source_transform_id: 1 });

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql({ submission_id: 1 });
    });
  });

  describe('insertSubmissionRecordWithPotentialConflict', () => {
    it('should return submission_id on get or insert', async () => {
      const mockDBConnection = getMockDBConnection();
      const submissionService = new SubmissionService(mockDBConnection);

      const repo = sinon
        .stub(SubmissionRepository.prototype, 'insertSubmissionRecordWithPotentialConflict')
        .resolves({ submission_id: 1 });

      const response = await submissionService.insertSubmissionRecordWithPotentialConflict('aaaa');

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql({ submission_id: 1 });
    });
  });

  describe('updateSubmissionMetadataEMLSource', () => {
    it('should return submission_id on update', async () => {
      const mockDBConnection = getMockDBConnection();
      const submissionService = new SubmissionService(mockDBConnection);

      const repo = sinon
        .stub(SubmissionRepository.prototype, 'updateSubmissionMetadataEMLSource')
        .resolves({ submission_metadata_id: 1 });

      const response = await submissionService.updateSubmissionMetadataEMLSource(1, 1, { emlFile: {} } as EMLFile);

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql({ submission_metadata_id: 1 });
    });
  });

  describe('updateSubmissionRecordEMLJSONSource', () => {
    it('should return submission_id on update', async () => {
      const mockDBConnection = getMockDBConnection();
      const submissionService = new SubmissionService(mockDBConnection);

      const repo = sinon
        .stub(SubmissionRepository.prototype, 'updateSubmissionMetadataEMLJSONSource')
        .resolves({ submission_metadata_id: 1 });

      const response = await submissionService.updateSubmissionRecordEMLJSONSource(1, 1, 'test');

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql({ submission_metadata_id: 1 });
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

  describe('updateSubmissionMetadataRecordEndDate', () => {
    it('should return submission_id on update', async () => {
      const mockDBConnection = getMockDBConnection();
      const submissionService = new SubmissionService(mockDBConnection);

      const repo = sinon.stub(SubmissionRepository.prototype, 'updateSubmissionMetadataRecordEndDate').resolves(1);

      const response = await submissionService.updateSubmissionMetadataRecordEndDate(1);

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql(1);
    });
  });

  describe('updateSubmissionMetadataRecordEffectiveDate', () => {
    it('should return submission_id on update', async () => {
      const mockDBConnection = getMockDBConnection();
      const submissionService = new SubmissionService(mockDBConnection);

      const repo = sinon
        .stub(SubmissionRepository.prototype, 'updateSubmissionMetadataRecordEffectiveDate')
        .resolves(1);

      const response = await submissionService.updateSubmissionMetadataRecordEffectiveDate(1);

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql(1);
    });
  });

  describe('updateSubmissionObservationRecordEndDate', () => {
    it('should return submission_id on update', async () => {
      const mockDBConnection = getMockDBConnection();
      const submissionService = new SubmissionService(mockDBConnection);

      const repo = sinon.stub(SubmissionRepository.prototype, 'updateSubmissionObservationRecordEndDate').resolves(1);

      const response = await submissionService.updateSubmissionObservationRecordEndDate(1);

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql(1);
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

  describe('getSubmissionRecordEMLJSONByDatasetId', () => {
    describe('with no matching submission', () => {
      it('should return eml string', async () => {
        const mockDBConnection = getMockDBConnection();
        const submissionService = new SubmissionService(mockDBConnection);

        const getSubmissionRecordEMLJSONByDatasetIdStub = sinon
          .stub(SubmissionRepository.prototype, 'getSubmissionRecordEMLJSONByDatasetId')
          .resolves({ rowCount: 0, rows: [] } as unknown as QueryResult);

        try {
          await submissionService.getSubmissionRecordEMLJSONByDatasetId('333-333-333');
          expect.fail();
        } catch (error) {
          expect(getSubmissionRecordEMLJSONByDatasetIdStub).to.be.calledOnce;
          expect((error as ApiExecuteSQLError).message).to.equal('Failed to get dataset');
        }
      });
    });

    describe('with matching submission', () => {
      it('should return eml string', async () => {
        const mockDBConnection = getMockDBConnection();
        const submissionService = new SubmissionService(mockDBConnection);

        const getSubmissionRecordEMLJSONByDatasetIdStub = sinon
          .stub(SubmissionRepository.prototype, 'getSubmissionRecordEMLJSONByDatasetId')
          .resolves({ rowCount: 1, rows: [{ eml_json_source: 'eml string' }] } as unknown as QueryResult);

        const response = await submissionService.getSubmissionRecordEMLJSONByDatasetId('333-333-333');

        expect(getSubmissionRecordEMLJSONByDatasetIdStub).to.be.calledOnce;
        expect(response).to.equal('eml string');
      });
    });
  });

  describe('findSubmissionRecordEMLJSONByDatasetId', () => {
    describe('with no matching submission', () => {
      it('should return eml string', async () => {
        const mockDBConnection = getMockDBConnection();
        const submissionService = new SubmissionService(mockDBConnection);

        const getSubmissionRecordEMLJSONByDatasetIdStub = sinon
          .stub(SubmissionRepository.prototype, 'getSubmissionRecordEMLJSONByDatasetId')
          .resolves({ rowCount: 0, rows: [] } as unknown as QueryResult);

        const response = await submissionService.findSubmissionRecordEMLJSONByDatasetId('333-333-333');

        expect(getSubmissionRecordEMLJSONByDatasetIdStub).to.be.calledOnce;
        expect(response).to.be.null;
      });
    });

    describe('with matching submission', () => {
      it('should return eml string', async () => {
        const mockDBConnection = getMockDBConnection();
        const submissionService = new SubmissionService(mockDBConnection);

        const getSubmissionRecordEMLJSONByDatasetIdStub = sinon
          .stub(SubmissionRepository.prototype, 'getSubmissionRecordEMLJSONByDatasetId')
          .resolves({ rowCount: 1, rows: [{ eml_json_source: 'eml string' }] } as unknown as QueryResult);

        const response = await submissionService.findSubmissionRecordEMLJSONByDatasetId('333-333-333');

        expect(getSubmissionRecordEMLJSONByDatasetIdStub).to.be.calledOnce;
        expect(response).to.equal('eml string');
      });
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
          input_key: 'biohub/1/moose_aerial_stratifiedrandomblock_composition_recruitment_survey_2.5_withdata.zip',
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

  describe('findSubmissionRecordsWithSpatialCount', () => {
    it('should return array of records', async () => {
      const mockDBConnection = getMockDBConnection();
      const submissionService = new SubmissionService(mockDBConnection);

      const findSubmissionRecordWithSpatialCountStub = sinon
        .stub(SubmissionService.prototype, 'findSubmissionRecordWithSpatialCount')
        .onCall(0)
        .resolves({ id: '111-111-111', source: {}, observation_count: 0 })
        .onCall(1)
        .resolves({ id: '222-222-222', source: {}, observation_count: 200 })
        .onCall(2)
        .resolves(null);

      const response = await submissionService.findSubmissionRecordsWithSpatialCount([
        '111-111-111',
        '222-222-222',
        '333-333-333'
      ]);

      expect(findSubmissionRecordWithSpatialCountStub).to.be.calledThrice;
      expect(response).to.be.eql([
        { id: '111-111-111', source: {}, observation_count: 0 },
        { id: '222-222-222', source: {}, observation_count: 200 },
        null
      ]);
    });
  });

  describe('findSubmissionRecordWithSpatialCount', () => {
    afterEach(() => {
      sinon.restore();
    });

    describe('with no occurrence spatial components', () => {
      it('should return submission with count object', async () => {
        const mockDBConnection = getMockDBConnection();
        const submissionService = new SubmissionService(mockDBConnection);
        const mockUserObject = { role_names: [] } as unknown as UserObject;
        sinon.stub(UserService.prototype, 'getUserById').resolves(mockUserObject);

        const findSubmissionRecordEMLJSONByDatasetIdStub = sinon
          .stub(SubmissionService.prototype, 'findSubmissionRecordEMLJSONByDatasetId')
          .resolves({});

        const getSpatialComponentCountByDatasetIdStub = sinon
          .stub(SubmissionRepository.prototype, 'getSpatialComponentCountByDatasetId')
          .resolves([{ spatial_type: 'Occurrence', count: 0 }]);

        const response = await submissionService.findSubmissionRecordWithSpatialCount('111-111-111');

        expect(findSubmissionRecordEMLJSONByDatasetIdStub).to.be.calledOnce;
        expect(getSpatialComponentCountByDatasetIdStub).to.be.calledOnce;
        expect(response).to.be.eql({ id: '111-111-111', source: {}, observation_count: 0 });
      });
    });

    describe('with a non-zero number of occurrence spatial components', () => {
      it('should return submission with count object', async () => {
        const mockDBConnection = getMockDBConnection();
        const submissionService = new SubmissionService(mockDBConnection);
        const mockUserObject = { role_names: [] } as unknown as UserObject;
        sinon.stub(UserService.prototype, 'getUserById').resolves(mockUserObject);

        const findSubmissionRecordEMLJSONByDatasetIdStub = sinon
          .stub(SubmissionService.prototype, 'findSubmissionRecordEMLJSONByDatasetId')
          .resolves({})
          .resolves({});

        const getSpatialComponentCountByDatasetIdStub = sinon
          .stub(SubmissionRepository.prototype, 'getSpatialComponentCountByDatasetId')

          .resolves([{ spatial_type: 'Occurrence', count: 200 }]);

        const response = await submissionService.findSubmissionRecordWithSpatialCount('222-222-222');

        expect(findSubmissionRecordEMLJSONByDatasetIdStub).to.be.calledOnce;
        expect(getSpatialComponentCountByDatasetIdStub).to.be.calledOnce;
        expect(response).to.be.eql({ id: '222-222-222', source: {}, observation_count: 200 });
      });
    });

    describe('with no matching submission', () => {
      it('should return null', async () => {
        const mockDBConnection = getMockDBConnection();
        const submissionService = new SubmissionService(mockDBConnection);
        const mockUserObject = { role_names: [] } as unknown as UserObject;
        sinon.stub(UserService.prototype, 'getUserById').resolves(mockUserObject);

        const findSubmissionRecordEMLJSONByDatasetIdStub = sinon
          .stub(SubmissionService.prototype, 'findSubmissionRecordEMLJSONByDatasetId')
          .resolves(null);

        const getSpatialComponentCountByDatasetIdStub = sinon
          .stub(SubmissionRepository.prototype, 'getSpatialComponentCountByDatasetId')
          .resolves([]);

        const response = await submissionService.findSubmissionRecordWithSpatialCount('333-333-333');

        expect(findSubmissionRecordEMLJSONByDatasetIdStub).to.be.calledOnce;
        expect(getSpatialComponentCountByDatasetIdStub).to.be.calledOnce;
        expect(response).to.be.null;
      });
    });
  });

  describe('getSubmissionJobQueue', () => {
    it('should return a submission job queue record', async () => {
      const mockDBConnection = getMockDBConnection();
      const submissionService = new SubmissionService(mockDBConnection);

      const repo = sinon
        .stub(SubmissionRepository.prototype, 'getSubmissionJobQueue')
        .resolves({ test: 'test' } as unknown as ISubmissionJobQueueRecord);

      const response = await submissionService.getSubmissionJobQueue(1);

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql({ test: 'test' });
    });
  });

  describe('insertSubmissionObservationRecord', () => {
    it('should return a submission observation record', async () => {
      const mockDBConnection = getMockDBConnection();
      const submissionService = new SubmissionService(mockDBConnection);

      const repo = sinon.stub(SubmissionRepository.prototype, 'insertSubmissionObservationRecord').resolves({
        submission_observation_id: 1
      });

      const response = await submissionService.insertSubmissionObservationRecord({
        test: 'test'
      } as unknown as ISubmissionObservationRecord);

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql({
        submission_observation_id: 1
      });
    });
  });

  describe('findRelatedDatasetsByDatasetId', () => {
    it('should return a valid array of related datasets on success', async () => {
      const mockDBConnection = getMockDBConnection();
      const submissionService = new SubmissionService(mockDBConnection);

      const mockEmlJson = {
        'eml:eml': {
          dataset: {
            project: {
              relatedProject: [
                {
                  '@_id': 'abcde',
                  title: 'Test-Title',
                  '@_system': 'http://example.com/datasets'
                }
              ]
            }
          }
        }
      };

      const emlStub = sinon
        .stub(SubmissionService.prototype, 'getSubmissionRecordEMLJSONByDatasetId')
        .resolves(mockEmlJson);

      const response = await submissionService.findRelatedDatasetsByDatasetId('test-dataset-id');

      expect(response).to.eql([
        {
          datasetId: 'abcde',
          title: 'Test-Title',
          url: 'http://example.com/datasets/abcde'
        }
      ]);

      expect(emlStub).to.be.calledOnce;
      expect(emlStub).to.be.calledWith('test-dataset-id');
    });

    it('should return an empty array if no EML JSON could be found', async () => {
      const mockDBConnection = getMockDBConnection();
      const submissionService = new SubmissionService(mockDBConnection);

      const emlStub = sinon
        .stub(SubmissionService.prototype, 'getSubmissionRecordEMLJSONByDatasetId')
        .resolves(null as unknown as Record<string, unknown>);

      const response = await submissionService.findRelatedDatasetsByDatasetId('test-dataset-id');

      expect(response).to.eql([]);
      expect(emlStub).to.be.calledOnce;
      expect(emlStub).to.be.calledWith('test-dataset-id');
    });

    it('should return an empty array if JSON Path fails to return any results', async () => {
      const mockDBConnection = getMockDBConnection();
      const submissionService = new SubmissionService(mockDBConnection);

      const emlStub = sinon.stub(SubmissionService.prototype, 'getSubmissionRecordEMLJSONByDatasetId').resolves({});

      const jsonPathStub = sinon.stub(JSONPathPlus, 'JSONPath').returns([]);

      const response = await submissionService.findRelatedDatasetsByDatasetId('test-dataset-id');

      expect(response).to.eql([]);
      expect(emlStub).to.be.calledOnce;
      expect(emlStub).to.be.calledWith('test-dataset-id');
      expect(jsonPathStub).to.be.calledOnce;
      expect(jsonPathStub).to.be.calledWith({
        path: '$..eml:eml..relatedProject',
        json: {},
        resultType: 'all'
      });
    });
  });

  describe('getDatasetsForReview', () => {
    it('should return a rolled up dataset for review', async () => {
      const mockDBConnection = getMockDBConnection();
      const submissionService = new SubmissionService(mockDBConnection);

      const stubDataset = sinon.stub(SubmissionRepository.prototype, 'getDatasetsForReview').resolves([
        {
          dataset_id: 'UUID',
          submission_id: 1,
          dataset_name: 'Project Name',
          keywords: [],
          related_projects: []
        },
        {
          dataset_id: 'UUID',
          submission_id: 2,
          dataset_name: 'Project Name',
          keywords: [],
          related_projects: [{ ['@_id']: 'RP_UUID_1' }, { ['@_id']: 'RP_UUID_2' }]
        },
        {
          dataset_id: 'UUID',
          submission_id: 3,
          dataset_name: 'Project Name',
          keywords: [],
          related_projects: [{ ['@_id']: 'RP_UUID_3' }]
        }
      ]);
      const stubArtifactCount = sinon
        .stub(SubmissionRepository.prototype, 'getArtifactForReviewCountForSubmissionUUID')
        .resolves({
          dataset_id: '',
          submission_id: 1,
          artifacts_to_review: 1,
          last_updated: ''
        });

      const response = await submissionService.getDatasetsForReview(['']);

      expect(stubDataset).to.be.calledOnce;
      expect(stubArtifactCount).to.be.calledWith('RP_UUID_1');
      expect(stubArtifactCount).to.be.calledWith('RP_UUID_2');
      expect(stubArtifactCount).to.be.calledWith('RP_UUID_3');
      expect(response).to.be.eql([
        {
          dataset_id: '',
          artifacts_to_review: 1,
          dataset_name: 'Project Name',
          last_updated: '',
          keywords: []
        },
        {
          dataset_id: '',
          artifacts_to_review: 3,
          dataset_name: 'Project Name',
          last_updated: '',
          keywords: []
        },
        {
          dataset_id: '',
          artifacts_to_review: 2,
          dataset_name: 'Project Name',
          last_updated: '',
          keywords: []
        }
      ]);
    });
  });

  describe('updateSubmissionMetadataWithSearchKeys', () => {
    it('should succeed with valid data', async () => {
      const mockDBConnection = getMockDBConnection();
      const submissionService = new SubmissionService(mockDBConnection);

      const repo = sinon.stub(SubmissionRepository.prototype, 'updateSubmissionMetadataWithSearchKeys').resolves(1);

      const response = await submissionService.updateSubmissionMetadataWithSearchKeys(1, {});

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql(1);
    });
  });

  describe('getHandleBarsTemplateByDatasetId', () => {
    it('should succeed with valid data', async () => {
      const mockDBConnection = getMockDBConnection();
      const submissionService = new SubmissionService(mockDBConnection);

      const repo = sinon.stub(SubmissionRepository.prototype, 'getHandleBarsTemplateByDatasetId').resolves({
        header: 'header',
        details: 'details'
      });

      const response = await submissionService.getHandleBarsTemplateByDatasetId('uuid');

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql({
        header: 'header',
        details: 'details'
      });
    });
  });

  describe('getUnreviewedSubmissionsForAdmins', () => {
    it('should return an array of submission records', async () => {
      const mockSubmissionRecords: SubmissionRecord[] = [
        {
          submission_id: 1,
          uuid: '123-456-789',
          security_review_timestamp: null,
          source_system: 'SIMS',
          name: 'name',
          description: 'description',
          create_date: '2023-12-12',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0
        },
        {
          submission_id: 2,
          uuid: '789-456-123',
          security_review_timestamp: '2023-12-12',
          source_system: 'SIMS',
          name: 'name',
          description: 'description',
          create_date: '2023-12-12',
          create_user: 1,
          update_date: '2023-12-12',
          update_user: 1,
          revision_count: 1
        }
      ];

      const mockDBConnection = getMockDBConnection();

      const getUnreviewedSubmissionsForAdminsStub = sinon
        .stub(SubmissionRepository.prototype, 'getUnreviewedSubmissionsForAdmins')
        .resolves(mockSubmissionRecords);

      const submissionService = new SubmissionService(mockDBConnection);

      const response = await submissionService.getUnreviewedSubmissionsForAdmins();

      expect(getUnreviewedSubmissionsForAdminsStub).to.be.calledOnce;
      expect(response).to.be.eql(mockSubmissionRecords);
    });
  });

  describe('getReviewedSubmissionsForAdmins', () => {
    it('should return an array of submission records', async () => {
      const mockSubmissionRecords: SubmissionRecord[] = [
        {
          submission_id: 1,
          uuid: '123-456-789',
          security_review_timestamp: null,
          source_system: 'SIMS',
          name: 'name',
          description: 'description',
          create_date: '2023-12-12',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0
        },
        {
          submission_id: 2,
          uuid: '789-456-123',
          security_review_timestamp: '2023-12-12',
          source_system: 'SIMS',
          name: 'name',
          description: 'description',
          create_date: '2023-12-12',
          create_user: 1,
          update_date: '2023-12-12',
          update_user: 1,
          revision_count: 1
        }
      ];

      const mockDBConnection = getMockDBConnection();

      const getReviewedSubmissionsForAdminsStub = sinon
        .stub(SubmissionRepository.prototype, 'getReviewedSubmissionsForAdmins')
        .resolves(mockSubmissionRecords);

      const submissionService = new SubmissionService(mockDBConnection);

      const response = await submissionService.getReviewedSubmissionsForAdmins();

      expect(getReviewedSubmissionsForAdminsStub).to.be.calledOnce;
      expect(response).to.be.eql(mockSubmissionRecords);
    });
  });

  describe('getReviewedSubmissionsWithSecurity', () => {
    it('should return an array of submission records with security property', async () => {
      const mockSubmissionRecords: SubmissionWithSecurityRecord[] = [
        {
          submission_id: 1,
          uuid: '123-456-789',
          security: SECURITY_APPLIED_STATUS.SECURED,
          security_review_timestamp: '2023-12-12',
          source_system: 'SIMS',
          name: 'name',
          description: 'description',
          create_date: '2023-12-12',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0
        },
        {
          submission_id: 2,
          uuid: '789-456-123',
          security: SECURITY_APPLIED_STATUS.PARTIALLY_SECURED,
          security_review_timestamp: '2023-12-12',
          source_system: 'SIMS',
          name: 'name',
          description: 'description',
          create_date: '2023-12-12',
          create_user: 1,
          update_date: '2023-12-12',
          update_user: 1,
          revision_count: 1
        },
        {
          submission_id: 3,
          security: SECURITY_APPLIED_STATUS.UNSECURED,
          uuid: '999-456-123',
          security_review_timestamp: '2023-12-12',
          source_system: 'SIMS',
          name: 'name',
          description: 'description',
          create_date: '2023-12-12',
          create_user: 1,
          update_date: '2023-12-12',
          update_user: 1,
          revision_count: 1
        }
      ];

      const mockDBConnection = getMockDBConnection();

      const getReviewedSubmissionsForAdminsStub = sinon
        .stub(SubmissionRepository.prototype, 'getReviewedSubmissionsWithSecurity')
        .resolves(mockSubmissionRecords);

      const submissionService = new SubmissionService(mockDBConnection);

      const response = await submissionService.getReviewedSubmissionsWithSecurity();

      expect(getReviewedSubmissionsForAdminsStub).to.be.calledOnce;
      expect(response).to.be.eql(mockSubmissionRecords);
    });
  });

  describe('createMessages', () => {
    beforeEach(() => {
      sinon.restore();
    });

    it('should create messages and return void', async () => {
      const submissionId = 1;

      const mockMessages = [
        {
          submission_message_type_id: 2,
          label: 'label1',
          message: 'message1',
          data: null
        },
        {
          submission_message_type_id: 3,
          label: 'label2',
          message: 'message2',
          data: {
            dataField: 'dataField'
          }
        }
      ];

      const mockDBConnection = getMockDBConnection();

      const createMessagesStub = sinon.stub(SubmissionRepository.prototype, 'createMessages').resolves(undefined);

      const submissionService = new SubmissionService(mockDBConnection);

      const response = await submissionService.createMessages(submissionId, mockMessages);

      expect(createMessagesStub).to.have.been.calledOnceWith([
        {
          submission_id: submissionId,
          submission_message_type_id: 2,
          label: 'label1',
          message: 'message1',
          data: null
        },
        {
          submission_id: submissionId,
          submission_message_type_id: 3,
          label: 'label2',
          message: 'message2',
          data: {
            dataField: 'dataField'
          }
        }
      ]);
      expect(response).to.be.undefined;
    });
  });
});
