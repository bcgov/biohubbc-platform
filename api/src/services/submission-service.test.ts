import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiGeneralError } from '../errors/api-error';
import { SubmissionFeatureSearchKeyValues } from '../repositories/search-index-respository';
import { SECURITY_APPLIED_STATUS } from '../repositories/security-repository';
import {
  ISubmissionFeature,
  ISubmissionJobQueueRecord,
  ISubmissionModel,
  PatchSubmissionRecord,
  SubmissionFeatureDownloadRecord,
  SubmissionFeatureRecord,
  SubmissionFeatureRecordWithTypeAndSecurity,
  SubmissionFeatureSignedUrlPayload,
  SubmissionRecord,
  SubmissionRecordPublishedForPublic,
  SubmissionRecordWithSecurity,
  SubmissionRecordWithSecurityAndRootFeatureType,
  SubmissionRepository,
  SUBMISSION_MESSAGE_TYPE,
  SUBMISSION_STATUS_TYPE
} from '../repositories/submission-repository';
import * as fileUtils from '../utils/file-utils';
import { getMockDBConnection } from '../__mocks__/db';
import { SearchIndexService } from './search-index-service';
import { SubmissionService } from './submission-service';

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

      const mockSubmissionRecord: SubmissionRecord = {
        submission_id: 1,
        uuid: '123-456-789',
        security_review_timestamp: '2023-12-12',
        submitted_timestamp: '2023-12-12',
        system_user_id: 3,
        source_system: 'SIMS',
        name: 'name',
        description: 'description',
        comment: 'comment',
        publish_timestamp: '2023-12-12',
        create_date: '2023-12-12',
        create_user: 1,
        update_date: null,
        update_user: null,
        revision_count: 0
      };

      const repo = sinon
        .stub(SubmissionRepository.prototype, 'insertSubmissionRecordWithPotentialConflict')
        .resolves(mockSubmissionRecord);

      const response = await submissionService.insertSubmissionRecordWithPotentialConflict(
        '123-456-789',
        'submission name',
        'submission desc',
        'submission comment',
        3,
        'source system'
      );

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql(mockSubmissionRecord);
    });
  });

  describe('insertSubmissionFeatureRecords', () => {
    it('inserts submission feature records', async () => {
      const mockDBConnection = getMockDBConnection();

      const submissionId = 1;
      const parentSubmissionFeatureId = 2;

      const insertSubmissionFeatureRecordStub = sinon
        .stub(SubmissionRepository.prototype, 'insertSubmissionFeatureRecord')
        .resolves({ submission_feature_id: parentSubmissionFeatureId });

      const submissionFeatures: ISubmissionFeature[] = [
        {
          id: '1-1',
          type: 'dataset',
          properties: {
            name: 'Dataset1'
          },
          child_features: [
            {
              id: '2-1',
              type: 'sample_site',
              properties: {
                name: 'SampleSite1'
              },
              child_features: [
                {
                  id: '3-1',
                  type: 'observation',
                  properties: {
                    count: 11,
                    geometry: {
                      type: 'Feature',
                      properties: {},
                      geometry: {
                        coordinates: [-125.81103991280563, 49.82351418845636],
                        type: 'Point'
                      }
                    }
                  },
                  child_features: []
                },
                {
                  id: '3-2',
                  type: 'observation',
                  properties: {
                    count: 12
                  },
                  child_features: []
                }
              ]
            },
            {
              id: '2-2',
              type: 'sample_site',
              properties: {
                name: 'SampleSite2',
                dateRange: {
                  start_date: '2024-01-01',
                  end_date: '2024-02-01'
                }
              },
              child_features: [
                {
                  id: '3-3',
                  type: 'observation',
                  properties: {
                    count: 13
                  },
                  child_features: []
                },
                {
                  id: '3-4',
                  type: 'observation',
                  properties: {
                    count: 14
                  },
                  child_features: []
                }
              ]
            },
            {
              id: '2-3',
              type: 'artifact',
              properties: {
                filename: 'Artifact1.txt'
              },
              child_features: []
            },
            {
              id: '2-4',
              type: 'artifact',
              properties: {
                filename: 'Artifact2.txt'
              },
              child_features: []
            }
          ]
        }
      ];

      const submissionService = new SubmissionService(mockDBConnection);

      const response = await submissionService.insertSubmissionFeatureRecords(submissionId, submissionFeatures);

      expect(response).to.be.undefined;

      expect(insertSubmissionFeatureRecordStub.callCount).to.equal(9);
      expect(insertSubmissionFeatureRecordStub).to.have.been.calledWith(submissionId, null, '1-1', 'dataset', {
        name: 'Dataset1'
      });
      expect(insertSubmissionFeatureRecordStub).to.have.been.calledWith(
        submissionId,
        parentSubmissionFeatureId,
        '2-1',
        'sample_site',
        {
          name: 'SampleSite1'
        }
      );
      expect(insertSubmissionFeatureRecordStub).to.have.been.calledWith(
        submissionId,
        parentSubmissionFeatureId,
        '3-1',
        'observation',
        {
          count: 11,
          geometry: {
            type: 'Feature',
            properties: {},
            geometry: {
              coordinates: [-125.81103991280563, 49.82351418845636],
              type: 'Point'
            }
          }
        }
      );
      expect(insertSubmissionFeatureRecordStub).to.have.been.calledWith(
        submissionId,
        parentSubmissionFeatureId,
        '3-2',
        'observation',
        {
          count: 12
        }
      );
      expect(insertSubmissionFeatureRecordStub).to.have.been.calledWith(
        submissionId,
        parentSubmissionFeatureId,
        '2-2',
        'sample_site',
        {
          name: 'SampleSite2',
          dateRange: {
            start_date: '2024-01-01',
            end_date: '2024-02-01'
          }
        }
      );
      expect(insertSubmissionFeatureRecordStub).to.have.been.calledWith(
        submissionId,
        parentSubmissionFeatureId,
        '3-3',
        'observation',
        {
          count: 13
        }
      );
      expect(insertSubmissionFeatureRecordStub).to.have.been.calledWith(
        submissionId,
        parentSubmissionFeatureId,
        '3-4',
        'observation',
        {
          count: 14
        }
      );
      expect(insertSubmissionFeatureRecordStub).to.have.been.calledWith(
        submissionId,
        parentSubmissionFeatureId,
        '2-3',
        'artifact',
        {
          filename: 'Artifact1.txt'
        }
      );
      expect(insertSubmissionFeatureRecordStub).to.have.been.calledWith(
        submissionId,
        parentSubmissionFeatureId,
        '2-4',
        'artifact',
        {
          filename: 'Artifact2.txt'
        }
      );
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

  describe('getUnreviewedSubmissionsForAdmins', () => {
    it('should return an array of submission records', async () => {
      const mockSubmissionRecords: SubmissionRecordWithSecurityAndRootFeatureType[] = [
        {
          submission_id: 1,
          uuid: '123-456-789',
          security_review_timestamp: null,
          submitted_timestamp: '2023-12-12',
          system_user_id: 3,
          source_system: 'SIMS',
          name: 'name',
          description: 'description',
          comment: 'comment',
          publish_timestamp: '2023-12-12',
          create_date: '2023-12-12',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0,
          security: SECURITY_APPLIED_STATUS.PENDING,
          root_feature_type_id: 1,
          root_feature_type_name: 'dataset',
          regions: []
        },
        {
          submission_id: 2,
          uuid: '789-456-123',
          security_review_timestamp: '2023-12-12',
          submitted_timestamp: '2023-12-12',
          system_user_id: 3,
          source_system: 'SIMS',
          name: 'name',
          description: 'description',
          comment: 'comment',
          publish_timestamp: '2023-12-12',
          create_date: '2023-12-12',
          create_user: 1,
          update_date: '2023-12-12',
          update_user: 1,
          revision_count: 1,
          security: SECURITY_APPLIED_STATUS.PENDING,
          root_feature_type_id: 1,
          root_feature_type_name: 'dataset',
          regions: []
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
      const mockSubmissionRecords: SubmissionRecordWithSecurityAndRootFeatureType[] = [
        {
          submission_id: 1,
          uuid: '123-456-789',
          security_review_timestamp: null,
          submitted_timestamp: '2023-12-12',
          system_user_id: 3,
          source_system: 'SIMS',
          name: 'name',
          description: 'description',
          comment: 'comment',
          publish_timestamp: null,
          create_date: '2023-12-12',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0,
          security: SECURITY_APPLIED_STATUS.UNSECURED,
          root_feature_type_id: 1,
          root_feature_type_name: 'dataset',
          regions: []
        },
        {
          submission_id: 2,
          uuid: '789-456-123',
          security_review_timestamp: '2023-12-12',
          submitted_timestamp: '2023-12-12',
          system_user_id: 3,
          source_system: 'SIMS',
          name: 'name',
          description: 'description',
          comment: 'comment',
          publish_timestamp: null,
          create_date: '2023-12-12',
          create_user: 1,
          update_date: '2023-12-12',
          update_user: 1,
          revision_count: 1,
          security: SECURITY_APPLIED_STATUS.SECURED,
          root_feature_type_id: 1,
          root_feature_type_name: 'dataset',
          regions: []
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

  describe('getPublishedSubmissionsForAdmins', () => {
    it('should return an array of submission records', async () => {
      const mockSubmissionRecords: SubmissionRecordWithSecurityAndRootFeatureType[] = [
        {
          submission_id: 1,
          uuid: '123-456-789',
          security_review_timestamp: null,
          submitted_timestamp: '2023-12-12',
          source_system: 'SIMS',
          system_user_id: 3,
          name: 'name',
          description: 'description',
          comment: 'comment',
          publish_timestamp: null,
          create_date: '2023-12-12',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0,
          security: SECURITY_APPLIED_STATUS.UNSECURED,
          root_feature_type_id: 1,
          root_feature_type_name: 'dataset',
          regions: []
        },
        {
          submission_id: 2,
          uuid: '789-456-123',
          security_review_timestamp: '2023-12-12',
          submitted_timestamp: '2023-12-12',
          system_user_id: 3,
          source_system: 'SIMS',
          name: 'name',
          description: 'description',
          comment: 'comment',
          publish_timestamp: null,
          create_date: '2023-12-12',
          create_user: 1,
          update_date: '2023-12-12',
          update_user: 1,
          revision_count: 1,
          security: SECURITY_APPLIED_STATUS.SECURED,
          root_feature_type_id: 1,
          root_feature_type_name: 'dataset',
          regions: []
        }
      ];

      const mockDBConnection = getMockDBConnection();

      const getPublishedSubmissionsForAdminsStub = sinon
        .stub(SubmissionRepository.prototype, 'getPublishedSubmissionsForAdmins')
        .resolves(mockSubmissionRecords);

      const submissionService = new SubmissionService(mockDBConnection);

      const response = await submissionService.getPublishedSubmissionsForAdmins();

      expect(getPublishedSubmissionsForAdminsStub).to.be.calledOnce;
      expect(response).to.be.eql(mockSubmissionRecords);
    });
  });

  describe('getSubmissionRecordBySubmissionIdWithSecurity', () => {
    it('should return a submission observation record', async () => {
      const mockDBConnection = getMockDBConnection();
      const submissionService = new SubmissionService(mockDBConnection);

      const mockResponse: SubmissionRecordWithSecurity = {
        submission_id: 1,
        uuid: 'string',
        security_review_timestamp: null,
        submitted_timestamp: 'string',
        system_user_id: 3,
        source_system: 'string',
        name: 'string',
        description: null,
        comment: 'comment',
        publish_timestamp: '2023-12-12',
        create_date: 'string',
        create_user: 1,
        update_date: null,
        update_user: null,
        revision_count: 1,
        security: SECURITY_APPLIED_STATUS.SECURED
      };

      const repo = sinon
        .stub(SubmissionRepository.prototype, 'getSubmissionRecordBySubmissionIdWithSecurity')
        .resolves(mockResponse);

      const response = await submissionService.getSubmissionRecordBySubmissionIdWithSecurity(1);

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql(mockResponse);
    });
  });

  describe('getPublishedSubmissions', () => {
    it('should return an array of submission records with security property', async () => {
      const mockSubmissionRecords: SubmissionRecordPublishedForPublic[] = [
        {
          submission_id: 1,
          uuid: '123-456-789',
          security_review_timestamp: '2023-12-12',
          submitted_timestamp: '2023-12-12',
          system_user_id: 3,
          source_system: 'SIMS',
          name: 'name',
          description: 'description',
          publish_timestamp: '2023-12-12',
          create_date: '2023-12-12',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0,
          security: SECURITY_APPLIED_STATUS.SECURED,
          root_feature_type_id: 1,
          root_feature_type_name: 'type',
          root_feature_type_display_name: 'Type'
        },
        {
          submission_id: 2,
          uuid: '789-456-123',
          security_review_timestamp: '2023-12-12',
          submitted_timestamp: '2023-12-12',
          system_user_id: 3,
          source_system: 'SIMS',
          name: 'name',
          description: 'description',
          publish_timestamp: '2023-12-12',
          create_date: '2023-12-12',
          create_user: 1,
          update_date: '2023-12-12',
          update_user: 1,
          revision_count: 1,
          security: SECURITY_APPLIED_STATUS.PARTIALLY_SECURED,
          root_feature_type_id: 1,
          root_feature_type_name: 'type',
          root_feature_type_display_name: 'Type'
        },
        {
          submission_id: 3,
          uuid: '999-456-123',
          security_review_timestamp: '2023-12-12',
          submitted_timestamp: '2023-12-12',
          system_user_id: 3,
          source_system: 'SIMS',
          name: 'name',
          description: 'description',
          publish_timestamp: '2023-12-12',
          create_date: '2023-12-12',
          create_user: 1,
          update_date: '2023-12-12',
          update_user: 1,
          revision_count: 1,
          security: SECURITY_APPLIED_STATUS.UNSECURED,
          root_feature_type_id: 1,
          root_feature_type_name: 'type',
          root_feature_type_display_name: 'Type'
        }
      ];

      const mockDBConnection = getMockDBConnection();

      const getReviewedSubmissionsForAdminsStub = sinon
        .stub(SubmissionRepository.prototype, 'getPublishedSubmissions')
        .resolves(mockSubmissionRecords);

      const submissionService = new SubmissionService(mockDBConnection);

      const response = await submissionService.getPublishedSubmissions();

      expect(getReviewedSubmissionsForAdminsStub).to.be.calledOnce;
      expect(response).to.be.eql(mockSubmissionRecords);
    });
  });

  describe('getSubmissionFeaturesBySubmissionId', () => {
    it('should return an array of submission features', async () => {
      const mockDBConnection = getMockDBConnection();

      const submissionId = 1;

      const mockSubmissionRecords: SubmissionFeatureRecordWithTypeAndSecurity[] = [
        {
          submission_feature_id: 1,
          uuid: '111-234-345',
          submission_id: submissionId,
          feature_type_id: 2,
          source_id: 'source-id-1',
          data: {},
          parent_submission_feature_id: 4,
          record_effective_date: '2020-01-01',
          record_end_date: null,
          create_date: '2020-01-01',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0,
          feature_type_name: 'dataset',
          feature_type_display_name: 'Dataset',
          submission_feature_security_ids: []
        },
        {
          submission_feature_id: 2,
          uuid: '222-234-345',
          submission_id: submissionId,
          feature_type_id: 2,
          source_id: 'source-id-2',
          data: {},
          parent_submission_feature_id: 1,
          record_effective_date: '2020-01-01',
          record_end_date: null,
          create_date: '2020-01-01',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0,
          feature_type_name: 'observation',
          feature_type_display_name: 'Observation',
          submission_feature_security_ids: []
        },
        {
          submission_feature_id: 3,
          uuid: '333-234-345',
          submission_id: submissionId,
          feature_type_id: 2,
          source_id: 'source-id-3',
          data: {},
          parent_submission_feature_id: 1,
          record_effective_date: '2020-01-01',
          record_end_date: null,
          create_date: '2020-01-01',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0,
          feature_type_name: 'observation',
          feature_type_display_name: 'Observation',
          submission_feature_security_ids: []
        },
        {
          submission_feature_id: 4,
          uuid: '444-234-345',
          submission_id: submissionId,
          feature_type_id: 3,
          source_id: 'source-id-4',
          data: {},
          parent_submission_feature_id: 1,
          record_effective_date: '2020-01-01',
          record_end_date: null,
          create_date: '2020-01-01',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0,
          feature_type_name: 'artifact',
          feature_type_display_name: 'Artifact',
          submission_feature_security_ids: []
        }
      ];

      const getReviewedSubmissionsForAdminsStub = sinon
        .stub(SubmissionRepository.prototype, 'getSubmissionFeaturesBySubmissionId')
        .resolves(mockSubmissionRecords);

      const submissionService = new SubmissionService(mockDBConnection);

      const response = await submissionService.getSubmissionFeaturesBySubmissionId(submissionId);

      expect(getReviewedSubmissionsForAdminsStub).to.be.calledOnceWith(submissionId);
      expect(response).to.be.eql([
        {
          feature_type_name: 'dataset',
          feature_type_display_name: 'Dataset',
          features: [{ ...mockSubmissionRecords[0] }]
        },
        {
          feature_type_name: 'observation',
          feature_type_display_name: 'Observation',
          features: [{ ...mockSubmissionRecords[1] }, { ...mockSubmissionRecords[2] }]
        },
        {
          feature_type_name: 'artifact',
          feature_type_display_name: 'Artifact',
          features: [{ ...mockSubmissionRecords[3] }]
        }
      ]);
    });
  });

  describe('getSubmissionFeaturesWithSearchKeyValuesBySubmissionId', () => {
    it('should return an array of submission features', async () => {
      const mockDBConnection = getMockDBConnection();

      const submissionId = 1;

      const mockSubmissionRecords: SubmissionFeatureRecordWithTypeAndSecurity[] = [
        {
          submission_feature_id: 1,
          uuid: '111-234-345',
          submission_id: submissionId,
          feature_type_id: 2,
          source_id: 'source-id-1',
          data: {},
          parent_submission_feature_id: 4,
          record_effective_date: '2020-01-01',
          record_end_date: null,
          create_date: '2020-01-01',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0,
          feature_type_name: 'dataset',
          feature_type_display_name: 'Dataset',
          submission_feature_security_ids: []
        },
        {
          submission_feature_id: 2,
          uuid: '222-234-345',
          submission_id: submissionId,
          feature_type_id: 2,
          source_id: 'source-id-2',
          data: {},
          parent_submission_feature_id: 1,
          record_effective_date: '2020-01-01',
          record_end_date: null,
          create_date: '2020-01-01',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0,
          feature_type_name: 'observation',
          feature_type_display_name: 'Observation',
          submission_feature_security_ids: []
        },
        {
          submission_feature_id: 3,
          uuid: '333-234-345',
          submission_id: submissionId,
          feature_type_id: 2,
          source_id: 'source-id-3',
          data: {},
          parent_submission_feature_id: 1,
          record_effective_date: '2020-01-01',
          record_end_date: null,
          create_date: '2020-01-01',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0,
          feature_type_name: 'observation',
          feature_type_display_name: 'Observation',
          submission_feature_security_ids: []
        },
        {
          submission_feature_id: 4,
          uuid: '444-234-345',
          submission_id: submissionId,
          feature_type_id: 3,
          source_id: 'source-id-4',
          data: {},
          parent_submission_feature_id: 1,
          record_effective_date: '2020-01-01',
          record_end_date: null,
          create_date: '2020-01-01',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0,
          feature_type_name: 'artifact',
          feature_type_display_name: 'Artifact',
          submission_feature_security_ids: []
        }
      ];

      const mockSubmissionFeatureSearchKeyValues: SubmissionFeatureSearchKeyValues[] = [
        {
          search_id: 1,
          submission_feature_id: 1,
          feature_property_id: 1,
          feature_property_name: 'name',
          value: 'name1'
        },
        {
          search_id: 2,
          submission_feature_id: 1,
          feature_property_id: 2,
          feature_property_name: 'description',
          value: 'description1'
        },
        {
          search_id: 3,
          submission_feature_id: 2,
          feature_property_id: 3,
          feature_property_name: 'geometry',
          value: { type: 'Point', coordinates: [100.0, 0.0] }
        },
        {
          search_id: 4,
          submission_feature_id: 3,
          feature_property_id: 1,
          feature_property_name: 'name',
          value: 'name3'
        },
        {
          search_id: 5,
          submission_feature_id: 4,
          feature_property_id: 4,
          feature_property_name: 'start_date',
          value: '2024-02-02'
        },
        {
          search_id: 6,
          submission_feature_id: 4,
          feature_property_id: 5,
          feature_property_name: 'count',
          value: 15
        }
      ];

      const getReviewedSubmissionsForAdminsStub = sinon
        .stub(SubmissionRepository.prototype, 'getSubmissionFeaturesBySubmissionId')
        .resolves(mockSubmissionRecords);

      const getSearchKeyValuesBySubmissionIdStub = sinon
        .stub(SearchIndexService.prototype, 'getSearchKeyValuesBySubmissionId')
        .resolves(mockSubmissionFeatureSearchKeyValues);

      const submissionService = new SubmissionService(mockDBConnection);

      const response = await submissionService.getSubmissionFeaturesWithSearchKeyValuesBySubmissionId(submissionId);

      expect(getReviewedSubmissionsForAdminsStub).to.be.calledOnceWith(submissionId);
      expect(getSearchKeyValuesBySubmissionIdStub).to.be.calledOnceWith(submissionId);
      expect(response).to.be.eql([
        {
          feature_type_name: 'dataset',
          feature_type_display_name: 'Dataset',
          features: [
            {
              ...mockSubmissionRecords[0],
              data: {
                name: 'name1',
                description: 'description1'
              }
            }
          ]
        },
        {
          feature_type_name: 'observation',
          feature_type_display_name: 'Observation',
          features: [
            {
              ...mockSubmissionRecords[1],
              data: {
                geometry: { type: 'Point', coordinates: [100.0, 0.0] }
              }
            },
            {
              ...mockSubmissionRecords[2],
              data: {
                name: 'name3'
              }
            }
          ]
        },
        {
          feature_type_name: 'artifact',
          feature_type_display_name: 'Artifact',
          features: [
            {
              ...mockSubmissionRecords[3],
              data: {
                start_date: '2024-02-02',
                count: 15
              }
            }
          ]
        }
      ]);
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

  describe('patchSubmissionRecord', () => {
    it('should patch the submission record and return the updated record', async () => {
      const submissionId = 1;

      const patch: PatchSubmissionRecord = { security_reviewed: true };

      const mockSubmissionRecord: SubmissionRecord = {
        submission_id: 1,
        uuid: '123-456-789',
        security_review_timestamp: '2023-12-12',
        submitted_timestamp: '2023-12-12',
        system_user_id: 3,
        source_system: 'SIMS',
        name: 'name',
        description: 'description',
        comment: 'comment',
        publish_timestamp: '2023-12-12',
        create_date: '2023-12-12',
        create_user: 1,
        update_date: null,
        update_user: null,
        revision_count: 0
      };
      const mockDBConnection = getMockDBConnection();

      const patchSubmissionRecordStub = sinon
        .stub(SubmissionRepository.prototype, 'patchSubmissionRecord')
        .resolves(mockSubmissionRecord);

      const submissionService = new SubmissionService(mockDBConnection);

      const response = await submissionService.patchSubmissionRecord(submissionId, patch);

      expect(patchSubmissionRecordStub).to.be.calledOnceWith(submissionId, patch);
      expect(response).to.be.eql(mockSubmissionRecord);
    });
  });

  describe('getSubmissionFeatureByUuid', () => {
    it('finds and returns submission features', async () => {
      const mockDBConnection = getMockDBConnection();
      const submissionService = new SubmissionService(mockDBConnection);

      const submissionFeature: SubmissionFeatureRecord = {
        submission_feature_id: 2,
        uuid: '234-456-234',
        submission_id: 3,
        feature_type_id: 1,
        source_id: 'source-id',
        data: {},
        parent_submission_feature_id: 1,
        record_effective_date: '2024-01-01',
        record_end_date: null,
        create_date: '2024-01-01',
        create_user: 3,
        update_date: null,
        update_user: null,
        revision_count: 0
      };

      const getSubmissionFeatureByUuidStub = sinon
        .stub(SubmissionRepository.prototype, 'getSubmissionFeatureByUuid')
        .resolves(submissionFeature);

      const submissionFeatureUuid = '123-456-789';

      const response = await submissionService.getSubmissionFeatureByUuid(submissionFeatureUuid);

      expect(getSubmissionFeatureByUuidStub).to.be.calledOnceWith(submissionFeatureUuid);
      expect(response).to.be.eql(submissionFeature);
    });
  });

  describe('getSubmissionRootFeature', () => {
    it('finds and returns submission features', async () => {
      const mockDBConnection = getMockDBConnection();
      const submissionService = new SubmissionService(mockDBConnection);

      const submissionFeature: SubmissionFeatureRecord = {
        submission_feature_id: 2,
        uuid: '234-456-234',
        submission_id: 3,
        feature_type_id: 1,
        source_id: 'source-id',
        data: {},
        parent_submission_feature_id: 1,
        record_effective_date: '2024-01-01',
        record_end_date: null,
        create_date: '2024-01-01',
        create_user: 3,
        update_date: null,
        update_user: null,
        revision_count: 0
      };

      const getSubmissionRootFeatureStub = sinon
        .stub(SubmissionRepository.prototype, 'getSubmissionRootFeature')
        .resolves(submissionFeature);

      const submissionId = 1;

      const response = await submissionService.getSubmissionRootFeature(submissionId);

      expect(getSubmissionRootFeatureStub).to.be.calledOnceWith(submissionId);
      expect(response).to.be.eql(submissionFeature);
    });
  });

  describe('findSubmissionFeatures', () => {
    it('finds and returns submission features', async () => {
      const mockDBConnection = getMockDBConnection();
      const submissionService = new SubmissionService(mockDBConnection);

      const submissionFeaturesResponse: SubmissionFeatureRecord[] = [];

      const findSubmissionFeaturesStub = sinon
        .stub(SubmissionRepository.prototype, 'findSubmissionFeatures')
        .resolves(submissionFeaturesResponse);

      const criteria = {
        submissionId: 1,
        featureTypeNames: ['dataset', 'artifact']
      };

      const response = await submissionService.findSubmissionFeatures(criteria);

      expect(findSubmissionFeaturesStub).to.be.calledOnceWith(criteria);
      expect(response).to.be.eql(submissionFeaturesResponse);
    });
  });

  describe('downloadSubmission', () => {
    it('should get submission with associated features ready for download', async () => {
      const submissionId = 1;

      const mockResponse: SubmissionFeatureDownloadRecord[] = [
        {
          submission_feature_id: 1,
          parent_submission_feature_id: null,
          feature_type_name: 'string',
          data: {},
          level: 1
        }
      ];

      const mockDBConnection = getMockDBConnection();

      const downloadSubmissionStub = sinon
        .stub(SubmissionRepository.prototype, 'downloadSubmission')
        .resolves(mockResponse);

      const submissionService = new SubmissionService(mockDBConnection);

      const response = await submissionService.downloadSubmission(submissionId);

      expect(downloadSubmissionStub).to.be.calledOnceWith(submissionId);
      expect(response).to.be.eql(mockResponse);
    });
  });

  describe('downloadPublishedSubmission', () => {
    it('should get submission with associated features ready for download', async () => {
      const submissionId = 1;

      const mockResponse: SubmissionFeatureDownloadRecord[] = [
        {
          submission_feature_id: 1,
          parent_submission_feature_id: null,
          feature_type_name: 'string',
          data: {},
          level: 1
        }
      ];

      const mockDBConnection = getMockDBConnection();

      const downloadPublishedSubmissionStub = sinon
        .stub(SubmissionRepository.prototype, 'downloadPublishedSubmission')
        .resolves(mockResponse);

      const submissionService = new SubmissionService(mockDBConnection);

      const response = await submissionService.downloadPublishedSubmission(submissionId);

      expect(downloadPublishedSubmissionStub).to.be.calledOnceWith(submissionId);
      expect(response).to.be.eql(mockResponse);
    });
  });

  describe('getSubmissionFeatureSignedUrl', () => {
    const payload: SubmissionFeatureSignedUrlPayload = {
      isAdmin: true,
      submissionFeatureId: 1,
      submissionFeatureObj: { key: 'a', value: 'b' }
    };

    it('should call admin repository when isAdmin == true', async () => {
      const mockDBConnection = getMockDBConnection();

      const getAdminSubmissionFeatureSignedUrlStub = sinon
        .stub(SubmissionRepository.prototype, 'getAdminSubmissionFeatureArtifactKey')
        .resolves('KEY');

      const getSubmissionFeatureSignedUrlStub = sinon
        .stub(SubmissionRepository.prototype, 'getSubmissionFeatureArtifactKey')
        .resolves('KEY');

      const getS3SignedURLStub = sinon.stub(fileUtils, 'getS3SignedURL').resolves('signed-url');

      const submissionService = new SubmissionService(mockDBConnection);

      await submissionService.getSubmissionFeatureSignedUrl(payload);

      expect(getAdminSubmissionFeatureSignedUrlStub).to.be.calledOnceWith(payload);
      expect(getSubmissionFeatureSignedUrlStub).to.not.be.called;
      expect(getS3SignedURLStub).to.be.calledOnceWith('KEY');
    });

    it('should call regular user repository when isAdmin == false', async () => {
      const mockDBConnection = getMockDBConnection();

      const getSubmissionFeatureSignedUrlStub = sinon
        .stub(SubmissionRepository.prototype, 'getSubmissionFeatureArtifactKey')
        .resolves('KEY');

      const getAdminSubmissionFeatureSignedUrlStub = sinon
        .stub(SubmissionRepository.prototype, 'getAdminSubmissionFeatureArtifactKey')
        .resolves('KEY');

      const getS3SignedURLStub = sinon.stub(fileUtils, 'getS3SignedURL').resolves('signed-url');

      const submissionService = new SubmissionService(mockDBConnection);

      await submissionService.getSubmissionFeatureSignedUrl({ ...payload, isAdmin: false });

      expect(getSubmissionFeatureSignedUrlStub).to.be.calledOnceWith({ ...payload, isAdmin: false });
      expect(getAdminSubmissionFeatureSignedUrlStub).to.not.be.called;
      expect(getS3SignedURLStub).to.be.calledOnceWith('KEY');
    });

    it('should return signed url if no error', async () => {
      const mockDBConnection = getMockDBConnection();

      const getSubmissionFeatureSignedUrlStub = sinon
        .stub(SubmissionRepository.prototype, 'getSubmissionFeatureArtifactKey')
        .resolves('KEY');

      const getS3SignedUrlStub = sinon.stub(fileUtils, 'getS3SignedURL').resolves('S3KEY');

      const submissionService = new SubmissionService(mockDBConnection);

      const response = await submissionService.getSubmissionFeatureSignedUrl({ ...payload, isAdmin: false });

      expect(getS3SignedUrlStub).to.be.calledOnceWith('KEY');
      expect(getSubmissionFeatureSignedUrlStub).to.be.calledOnceWith({ ...payload, isAdmin: false });
      expect(response).to.be.eql('S3KEY');
    });

    it('should throw error if getS3SignedURL fails to generate (null)', async () => {
      const mockDBConnection = getMockDBConnection();

      const getSubmissionFeatureSignedUrlStub = sinon
        .stub(SubmissionRepository.prototype, 'getSubmissionFeatureArtifactKey')
        .resolves('KEY');

      const getS3SignedUrlStub = sinon.stub(fileUtils, 'getS3SignedURL').resolves(null);

      const submissionService = new SubmissionService(mockDBConnection);

      try {
        await submissionService.getSubmissionFeatureSignedUrl({ ...payload, isAdmin: false });
      } catch (err) {
        expect(getS3SignedUrlStub).to.be.calledOnceWith('KEY');
        expect(getSubmissionFeatureSignedUrlStub).to.be.calledOnceWith({ ...payload, isAdmin: false });
        expect((err as ApiGeneralError).message).to.equal(`Failed to generate signed URL for "a":"b"`);
      }
    });
  });
});
