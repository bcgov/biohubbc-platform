import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { Policy } from '../../models/policy';
import { TeamAuthorizationRepository } from '../../repositories/authorization/team-authorization-repository';
import { SubmissionFeature } from '../../repositories/submission-repository';
import { getMockDBConnection } from '../../__mocks__/db';
import { PolicyService } from '../access-policy/policy-service';
import { SubmissionService } from '../submission-service';
import { TeamAuthorizationService } from './team-authorization-service';

describe('TeamAuthorizationService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('isUserAuthorizedForTeamEntity', () => {
    describe('entity: team', () => {
      it('returns true when the user is a member of the team', async () => {
        const mockConnection = getMockDBConnection();
        sinon.stub(TeamAuthorizationRepository.prototype, 'findTeamMembership').resolves({ team_member_id: 'tm-1' });

        const service = new TeamAuthorizationService(mockConnection);
        const result = await service.isUserAuthorizedForTeamEntity(1, { entity: 'team', teamId: 'team-1' });

        expect(result).to.be.true;
      });

      it('returns false when the user is not a member of the team', async () => {
        const mockConnection = getMockDBConnection();
        sinon.stub(TeamAuthorizationRepository.prototype, 'findTeamMembership').resolves(null);

        const service = new TeamAuthorizationService(mockConnection);
        const result = await service.isUserAuthorizedForTeamEntity(1, { entity: 'team', teamId: 'team-1' });

        expect(result).to.be.false;
      });
    });

    describe('entity: policy', () => {
      it('returns true when the user has team access to the policy', async () => {
        const mockConnection = getMockDBConnection();
        sinon
          .stub(TeamAuthorizationRepository.prototype, 'findTeamMembershipByPolicy')
          .resolves({ team_policy_id: 'tp-1' });

        const service = new TeamAuthorizationService(mockConnection);
        const result = await service.isUserAuthorizedForTeamEntity(1, { entity: 'policy', policyId: 'policy-1' });

        expect(result).to.be.true;
      });

      it('returns false when the user does not have team access to the policy', async () => {
        const mockConnection = getMockDBConnection();
        sinon.stub(TeamAuthorizationRepository.prototype, 'findTeamMembershipByPolicy').resolves(null);

        const service = new TeamAuthorizationService(mockConnection);
        const result = await service.isUserAuthorizedForTeamEntity(1, { entity: 'policy', policyId: 'policy-1' });

        expect(result).to.be.false;
      });
    });

    describe('entity: data_request', () => {
      it('returns true when the user has team access to the data request', async () => {
        const mockConnection = getMockDBConnection();
        sinon
          .stub(TeamAuthorizationRepository.prototype, 'findTeamMembershipByDataRequest')
          .resolves({ data_request_id: 'dr-1' });

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
        secured: true
      };

      const mockPolicies: Policy[] = [{ policy_id: 'policy', description: 'desc', name: 'Policy' }];

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

      it('returns true if policies grant access', async () => {
        const mockConnection = getMockDBConnection();
        sinon.stub(SubmissionService.prototype, 'getSubmissionFeatureById').resolves(fakeFeature);
        sinon.stub(PolicyService.prototype, 'getPoliciesThatAuthorizeFeatureAccessByUrn').resolves(mockPolicies);

        const service = new TeamAuthorizationService(mockConnection);
        const result = await service.isUserAuthorizedForTeamEntity(1, {
          entity: 'submission_feature',
          submissionFeatureId: 1,
          submissionId: 1
        });

        expect(result).to.be.true;
      });

      it('returns false if no policies grant access', async () => {
        const mockConnection = getMockDBConnection();
        sinon.stub(SubmissionService.prototype, 'getSubmissionFeatureById').resolves(fakeFeature);
        sinon.stub(PolicyService.prototype, 'getPoliciesThatAuthorizeFeatureAccessByUrn').resolves([]);

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
