import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { SECURITY_APPLIED_STATUS } from '../repositories/security-repository';
import {
  ISubmissionModel,
  PatchSubmissionRecord,
  SUBMISSION_MESSAGE_TYPE,
  SUBMISSION_STATUS_TYPE,
  SubmissionFeatureRecord,
  SubmissionFeatureRecordWithTypeAndSecurity,
  SubmissionRecord,
  SubmissionRecordPublishedForPublic,
  SubmissionRecordWithSecurity,
  SubmissionRecordWithSecurityAndRootFeatureType,
  SubmissionRepository
} from '../repositories/submission-repository';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { TeamService } from './access-policy/team-service';
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

      const createTeam = sinon.stub(TeamService.prototype, 'createTeam').resolves({
        team_id: '11111111-1111-1111-1111-111111111111',
        name: 'Submission Team',
        description: null,
        member_count: 1
      });
      const repo = sinon.stub(SubmissionRepository.prototype, 'insertSubmissionRecord').resolves({ submission_id: 1 });

      const response = await submissionService.insertSubmissionRecord(
        {
          uuid: '',
          comment: 'comment',
          description: 'description',
          name: 'name',
          contributor_id: 1,
          system_user_id: 1
        },
        [2, 1]
      );

      expect(createTeam).to.have.been.calledOnceWith(
        sinon.match({
          system_user_ids: [1, 2]
        })
      );
      expect(repo).to.have.been.calledOnceWith(
        sinon.match({
          team_id: '11111111-1111-1111-1111-111111111111'
        })
      );
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
        team_id: '11111111-1111-1111-1111-111111111111',
        contributor_id: 1,
        name: 'name',
        description: 'description',
        comment: 'comment',
        publish_timestamp: '2023-12-12',
        record_end_date: '2023-12-12',
        create_date: '2023-12-12',
        create_user: 1,
        update_date: null,
        update_user: null,
        revision_count: 0
      };

      const repo = sinon
        .stub(SubmissionRepository.prototype, 'insertSubmissionRecordWithPotentialConflict')
        .resolves(mockSubmissionRecord);
      const createTeam = sinon.stub(TeamService.prototype, 'createTeam').resolves({
        team_id: '11111111-1111-1111-1111-111111111111',
        name: 'Submission Team',
        description: null,
        member_count: 1
      });

      const response = await submissionService.insertSubmissionRecordWithPotentialConflict(
        '123-456-789',
        'submission name',
        'submission desc',
        'submission comment',
        3,
        1
      );

      expect(createTeam).to.have.been.calledOnceWith(
        sinon.match({
          system_user_ids: [3]
        })
      );
      expect(repo).to.have.been.calledOnceWith(
        '123-456-789',
        'submission name',
        'submission desc',
        'submission comment',
        3,
        1,
        '11111111-1111-1111-1111-111111111111'
      );
      expect(response).to.be.eql(mockSubmissionRecord);
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

  describe('getUnreviewedSubmissionsForAdmins', () => {
    it('should return an array of submission records', async () => {
      const mockSubmissionRecords: SubmissionRecordWithSecurityAndRootFeatureType[] = [
        {
          submission_id: 1,
          uuid: '123-456-789',
          submitted_timestamp: '2023-12-12',
          system_user_id: 3,
          contributor_id: 1,
          name: 'name',
          description: 'description',
          comment: 'comment',
          publish_timestamp: '2023-12-12',
          create_user: 1,
          update_user: null,
          security: SECURITY_APPLIED_STATUS.PENDING,
          root_feature_type_id: 1,
          root_feature_type_name: 'survey',
          regions: []
        },
        {
          submission_id: 2,
          uuid: '789-456-123',
          submitted_timestamp: '2023-12-12',
          system_user_id: 3,
          contributor_id: 1,
          name: 'name',
          description: 'description',
          comment: 'comment',
          publish_timestamp: '2023-12-12',
          create_user: 1,
          update_user: 1,
          security: SECURITY_APPLIED_STATUS.PENDING,
          root_feature_type_id: 1,
          root_feature_type_name: 'survey',
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
          submitted_timestamp: '2023-12-12',
          system_user_id: 3,
          contributor_id: 1,
          name: 'name',
          description: 'description',
          comment: 'comment',
          publish_timestamp: null,
          create_user: 1,
          update_user: null,
          security: SECURITY_APPLIED_STATUS.UNSECURED,
          root_feature_type_id: 1,
          root_feature_type_name: 'survey',
          regions: []
        },
        {
          submission_id: 2,
          uuid: '789-456-123',
          submitted_timestamp: '2023-12-12',
          system_user_id: 3,
          contributor_id: 1,
          name: 'name',
          description: 'description',
          comment: 'comment',
          publish_timestamp: null,
          create_user: 1,
          update_user: 1,
          security: SECURITY_APPLIED_STATUS.SECURED,
          root_feature_type_id: 1,
          root_feature_type_name: 'survey',
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
          submitted_timestamp: '2023-12-12',
          contributor_id: 1,
          system_user_id: 3,
          name: 'name',
          description: 'description',
          comment: 'comment',
          publish_timestamp: null,
          create_user: 1,
          update_user: null,
          security: SECURITY_APPLIED_STATUS.UNSECURED,
          root_feature_type_id: 1,
          root_feature_type_name: 'survey',
          regions: []
        },
        {
          submission_id: 2,
          uuid: '789-456-123',
          submitted_timestamp: '2023-12-12',
          system_user_id: 3,
          contributor_id: 1,
          name: 'name',
          description: 'description',
          comment: 'comment',
          publish_timestamp: null,
          create_user: 1,
          update_user: 1,
          security: SECURITY_APPLIED_STATUS.SECURED,
          root_feature_type_id: 1,
          root_feature_type_name: 'survey',
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

  describe('getSubmissionsByUserId', () => {
    it('should return submissions accessible to the given user', async () => {
      const mockSubmissionRecords: SubmissionRecordWithSecurityAndRootFeatureType[] = [
        {
          submission_id: 1,
          uuid: '123-456-789',
          submitted_timestamp: '2023-12-12',
          contributor_id: 1,
          system_user_id: 3,
          name: 'name',
          description: 'description',
          comment: 'comment',
          publish_timestamp: null,
          create_user: 1,
          update_user: null,
          security: SECURITY_APPLIED_STATUS.UNSECURED,
          root_feature_type_id: 1,
          root_feature_type_name: 'survey',
          regions: []
        }
      ];

      const mockDBConnection = getMockDBConnection();

      const getSubmissionsByUserIdStub = sinon
        .stub(SubmissionRepository.prototype, 'getSubmissionsByUserId')
        .resolves(mockSubmissionRecords);

      const submissionService = new SubmissionService(mockDBConnection);
      const pagination: ApiPaginationOptions = { page: 1, limit: 10, sort: 'submitted_timestamp', order: 'desc' };

      const response = await submissionService.getSubmissionsByUserId(3, pagination);

      expect(getSubmissionsByUserIdStub).to.be.calledOnceWith(3, pagination);
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
        contributor_id: 1,
        name: 'string',
        description: null,
        comment: 'comment',
        publish_timestamp: '2023-12-12',
        record_end_date: 'string',
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
          contributor_id: 1,
          name: 'name',
          description: 'description',
          publish_timestamp: '2023-12-12',
          record_end_date: '2023-12-12',
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
          contributor_id: 1,
          name: 'name',
          description: 'description',
          publish_timestamp: '2023-12-12',
          record_end_date: '2023-12-12',
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
          contributor_id: 1,
          name: 'name',
          description: 'description',
          publish_timestamp: '2023-12-12',
          record_end_date: '2023-12-12',
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
          urn: `urn:${submissionId}:survey:1`,
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
          feature_type_name: 'survey',
          feature_type_display_name: 'Survey',
          submission_feature_security_ids: []
        },
        {
          submission_feature_id: 2,
          uuid: '222-234-345',
          submission_id: submissionId,
          urn: `urn:${submissionId}:survey:2`,
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
          urn: `urn:${submissionId}:survey:3`,
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
          urn: `urn:${submissionId}:survey:4`,
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
          feature_type_name: 'survey',
          feature_type_display_name: 'Survey',
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
        contributor_id: 1,
        name: 'name',
        description: 'description',
        comment: 'comment',
        publish_timestamp: '2023-12-12',
        record_end_date: '2023-12-12',
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

  describe('getSubmissionRootFeature', () => {
    it('finds and returns submission features', async () => {
      const mockDBConnection = getMockDBConnection();
      const submissionService = new SubmissionService(mockDBConnection);

      const submissionFeature: SubmissionFeatureRecord = {
        submission_feature_id: 2,
        uuid: '234-456-234',
        urn: 'urn:3:survey:2',
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
        featureTypeNames: ['survey', 'artifact']
      };

      const response = await submissionService.findSubmissionFeatures(criteria);

      expect(findSubmissionFeaturesStub).to.be.calledOnceWith(criteria);
      expect(response).to.be.eql(submissionFeaturesResponse);
    });
  });
});
