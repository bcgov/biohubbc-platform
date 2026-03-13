import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { TeamAuthorizationRepository } from '../../repositories/authorization/team-authorization-repository';
import { SubmissionFeature } from '../../repositories/submission-repository';
import { getMockDBConnection } from '../../__mocks__/db';
import { SubmissionService } from '../submission-service';
import { TeamAuthorizationService } from './team-authorization-service';

chai.use(sinonChai);

describe('TeamAuthorizationService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('isUserAuthorizedForTeamEntity', () => {
    describe('entity: data_request', () => {
      it('returns true when the user has active team access to the data request', async () => {
        const mockConnection = getMockDBConnection();
        sinon
          .stub(TeamAuthorizationRepository.prototype, 'findTeamMembershipByDataRequest')
          .resolves({ data_request_id: 'dr-1', record_end_date: null });

        const service = new TeamAuthorizationService(mockConnection);
        const result = await service.isUserAuthorizedForTeamEntity(1, {
          entity: 'data_request',
          dataRequestId: 'dr-1'
        });

        expect(result).to.be.true;
      });

      it('returns false when the user does not have team access to the data request', async () => {
        const mockConnection = getMockDBConnection();
        sinon.stub(TeamAuthorizationRepository.prototype, 'findTeamMembershipByDataRequest').resolves(null);

        const service = new TeamAuthorizationService(mockConnection);
        const result = await service.isUserAuthorizedForTeamEntity(1, {
          entity: 'data_request',
          dataRequestId: 'dr-1'
        });

        expect(result).to.be.false;
      });

      it('returns false when the team membership has expired', async () => {
        const mockConnection = getMockDBConnection();
        sinon
          .stub(TeamAuthorizationRepository.prototype, 'findTeamMembershipByDataRequest')
          .resolves({ data_request_id: 'dr-1', record_end_date: '2025-01-01' });

        const service = new TeamAuthorizationService(mockConnection);
        const result = await service.isUserAuthorizedForTeamEntity(1, {
          entity: 'data_request',
          dataRequestId: 'dr-1'
        });

        expect(result).to.be.false;
      });
    });

    describe('entity: submission_feature', () => {
      const fakeFeature: SubmissionFeature = {
        submission_feature_id: 1,
        uuid: 'uuid-1',
        urn: 'urn:1:Feature:1',
        submission_id: 1,
        feature_type_id: 10,
        source_id: null,
        data: {},
        feature_type_name: 'Feature',
        feature_type_display_name: 'Feature',
        submission_name: 'Test Submission',
        secured: true
      };

      it('returns true immediately if the feature is not secured', async () => {
        const mockConnection = getMockDBConnection();
        sinon
          .stub(SubmissionService.prototype, 'getSubmissionFeatureById')
          .resolves({ ...fakeFeature, secured: false });

        const service = new TeamAuthorizationService(mockConnection);
        const result = await service.isUserAuthorizedForTeamEntity(1, {
          entity: 'submission_feature',
          submissionFeatureId: 1,
          submissionId: 1
        });

        expect(result).to.be.true;
      });

      it('returns false if the submission ID does not match', async () => {
        const mockConnection = getMockDBConnection();
        sinon.stub(SubmissionService.prototype, 'getSubmissionFeatureById').resolves(fakeFeature);

        const service = new TeamAuthorizationService(mockConnection);
        const result = await service.isUserAuthorizedForTeamEntity(1, {
          entity: 'submission_feature',
          submissionFeatureId: 1,
          submissionId: 999
        });

        expect(result).to.be.false;
      });

      it('returns true when the user has active team policy access to the submission feature', async () => {
        const mockConnection = getMockDBConnection();
        sinon.stub(SubmissionService.prototype, 'getSubmissionFeatureById').resolves(fakeFeature);
        sinon
          .stub(TeamAuthorizationRepository.prototype, 'findTeamPolicyBySubmissionFeature')
          .resolves({ team_policy_id: 'tp-1', record_end_date: null });

        const service = new TeamAuthorizationService(mockConnection);
        const result = await service.isUserAuthorizedForTeamEntity(1, {
          entity: 'submission_feature',
          submissionFeatureId: 1,
          submissionId: 1
        });

        expect(result).to.be.true;
      });

      it('returns false when the user does not have team policy access to the submission feature', async () => {
        const mockConnection = getMockDBConnection();
        sinon.stub(SubmissionService.prototype, 'getSubmissionFeatureById').resolves(fakeFeature);
        sinon.stub(TeamAuthorizationRepository.prototype, 'findTeamPolicyBySubmissionFeature').resolves(null);

        const service = new TeamAuthorizationService(mockConnection);
        const result = await service.isUserAuthorizedForTeamEntity(1, {
          entity: 'submission_feature',
          submissionFeatureId: 1,
          submissionId: 1
        });

        expect(result).to.be.false;
      });

      it('returns false when the team membership has expired', async () => {
        const mockConnection = getMockDBConnection();
        sinon.stub(SubmissionService.prototype, 'getSubmissionFeatureById').resolves(fakeFeature);
        sinon
          .stub(TeamAuthorizationRepository.prototype, 'findTeamPolicyBySubmissionFeature')
          .resolves({ team_policy_id: 'tp-1', record_end_date: '2025-01-01' });

        const service = new TeamAuthorizationService(mockConnection);
        const result = await service.isUserAuthorizedForTeamEntity(1, {
          entity: 'submission_feature',
          submissionFeatureId: 1,
          submissionId: 1
        });

        expect(result).to.be.false;
      });
    });
  });
});
