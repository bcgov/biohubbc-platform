import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { CreateTeamPolicy, TeamPolicy, TeamPolicyDetails, UpdateTeamPolicy } from '../../models/team-policy';
import * as publisher from '../../queue/publisher';
import { TeamPolicyRepository } from '../../repositories/authorization/team-policy-repository';
import { getMockDBConnection } from '../../__mocks__/db';
import { TeamPolicyService } from './team-policy-service';

chai.use(sinonChai);

describe('TeamPolicyService', () => {
  let mockDBConnection: any;
  let service: TeamPolicyService;

  beforeEach(() => {
    mockDBConnection = getMockDBConnection();
    service = new TeamPolicyService(mockDBConnection);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('createTeamPolicy', () => {
    it('should call repository.insertTeamPolicy and return the created record', async () => {
      const mockTeamPolicy: TeamPolicy = {
        team_policy_id: '11111111-1111-1111-1111-111111111111',
        team_id: '22222222-2222-2222-2222-222222222222',
        policy_id: '33333333-3333-3333-3333-333333333333'
      };

      const getExistingStub = sinon.stub(TeamPolicyRepository.prototype, 'getPoliciesByTeamId').resolves([]);
      const stub = sinon.stub(TeamPolicyRepository.prototype, 'insertTeamPolicy').resolves(mockTeamPolicy);
      sinon.stub(publisher, 'publishRefreshTeamFeatureCacheJob').resolves({ status: 'published', jobId: 'j1' });

      const input: CreateTeamPolicy = {
        team_id: '22222222-2222-2222-2222-222222222222',
        policy_id: '33333333-3333-3333-3333-333333333333'
      };

      const result = await service.createTeamPolicy(input);

      expect(getExistingStub).to.have.been.calledWith('22222222-2222-2222-2222-222222222222', {
        policyIds: ['33333333-3333-3333-3333-333333333333']
      });
      expect(stub).to.have.been.calledWith(input);
      expect(result).to.eql(mockTeamPolicy);
    });

    it('should return existing team policy and skip insert when association already exists', async () => {
      const existingTeamPolicy: TeamPolicyDetails = {
        team_policy_id: '11111111-1111-1111-1111-111111111111',
        team_id: '22222222-2222-2222-2222-222222222222',
        policy_id: '33333333-3333-3333-3333-333333333333',
        team_name: 'Team A',
        policy_name: 'Policy A'
      };

      const getExistingStub = sinon
        .stub(TeamPolicyRepository.prototype, 'getPoliciesByTeamId')
        .resolves([existingTeamPolicy]);
      const insertStub = sinon.stub(TeamPolicyRepository.prototype, 'insertTeamPolicy');
      sinon.stub(publisher, 'publishRefreshTeamFeatureCacheJob').resolves({ status: 'published', jobId: 'j1' });

      const input: CreateTeamPolicy = {
        team_id: '22222222-2222-2222-2222-222222222222',
        policy_id: '33333333-3333-3333-3333-333333333333'
      };

      const result = await service.createTeamPolicy(input);

      expect(getExistingStub).to.have.been.calledWith('22222222-2222-2222-2222-222222222222', {
        policyIds: ['33333333-3333-3333-3333-333333333333']
      });
      expect(insertStub).to.not.have.been.called;
      expect(result).to.eql({
        team_policy_id: '11111111-1111-1111-1111-111111111111',
        team_id: '22222222-2222-2222-2222-222222222222',
        policy_id: '33333333-3333-3333-3333-333333333333'
      });
    });

    it('publishes cache refresh after new insert', async () => {
      const mockTeamPolicy: TeamPolicy = {
        team_policy_id: '11111111-1111-1111-1111-111111111111',
        team_id: '22222222-2222-2222-2222-222222222222',
        policy_id: '33333333-3333-3333-3333-333333333333'
      };

      sinon.stub(TeamPolicyRepository.prototype, 'getPoliciesByTeamId').resolves([]);
      sinon.stub(TeamPolicyRepository.prototype, 'insertTeamPolicy').resolves(mockTeamPolicy);
      const publishStub = sinon
        .stub(publisher, 'publishRefreshTeamFeatureCacheJob')
        .resolves({ status: 'published', jobId: 'j1' });

      await service.createTeamPolicy({
        team_id: '22222222-2222-2222-2222-222222222222',
        policy_id: '33333333-3333-3333-3333-333333333333'
      });

      expect(publishStub).to.have.been.calledOnce;
      expect(publishStub.firstCall.args[1]).to.eql({ teamId: '22222222-2222-2222-2222-222222222222' });
    });

    it('publishes cache refresh even on idempotent return', async () => {
      const existingTeamPolicy: TeamPolicyDetails = {
        team_policy_id: '11111111-1111-1111-1111-111111111111',
        team_id: '22222222-2222-2222-2222-222222222222',
        policy_id: '33333333-3333-3333-3333-333333333333',
        team_name: 'Team A',
        policy_name: 'Policy A'
      };

      sinon.stub(TeamPolicyRepository.prototype, 'getPoliciesByTeamId').resolves([existingTeamPolicy]);
      const publishStub = sinon
        .stub(publisher, 'publishRefreshTeamFeatureCacheJob')
        .resolves({ status: 'published', jobId: 'j1' });

      await service.createTeamPolicy({
        team_id: '22222222-2222-2222-2222-222222222222',
        policy_id: '33333333-3333-3333-3333-333333333333'
      });

      expect(publishStub).to.have.been.calledOnce;
      expect(publishStub.firstCall.args[1]).to.eql({ teamId: '22222222-2222-2222-2222-222222222222' });
    });
  });

  describe('getTeamPolicy', () => {
    it('should call repository.getTeamPolicy and return the record', async () => {
      const mockTeamPolicy: TeamPolicy = {
        team_policy_id: '11111111-1111-1111-1111-111111111111',
        team_id: '22222222-2222-2222-2222-222222222222',
        policy_id: '33333333-3333-3333-3333-333333333333'
      };

      const stub = sinon.stub(TeamPolicyRepository.prototype, 'getTeamPolicy').resolves(mockTeamPolicy);

      const result = await service.getTeamPolicy('11111111-1111-1111-1111-111111111111');

      expect(stub).to.have.been.calledWith('11111111-1111-1111-1111-111111111111');
      expect(result).to.eql(mockTeamPolicy);
    });
  });

  describe('createTeamPolicies', () => {
    it('should create unique policies in bulk when none exist', async () => {
      const getExistingStub = sinon.stub(TeamPolicyRepository.prototype, 'getPoliciesByTeamId').resolves([]);

      const insertStub = sinon.stub(TeamPolicyRepository.prototype, 'insertTeamPolicy');
      insertStub.onCall(0).resolves({
        team_policy_id: '11111111-1111-1111-1111-111111111111',
        team_id: '22222222-2222-2222-2222-222222222222',
        policy_id: '33333333-3333-3333-3333-333333333333'
      });
      insertStub.onCall(1).resolves({
        team_policy_id: '44444444-4444-4444-4444-444444444444',
        team_id: '22222222-2222-2222-2222-222222222222',
        policy_id: '55555555-5555-5555-5555-555555555555'
      });
      sinon.stub(publisher, 'publishRefreshTeamFeatureCacheJob').resolves({ status: 'published', jobId: 'j1' });

      const result = await service.createTeamPolicies('22222222-2222-2222-2222-222222222222', [
        '33333333-3333-3333-3333-333333333333',
        '55555555-5555-5555-5555-555555555555'
      ]);

      expect(getExistingStub).to.have.been.calledOnceWith('22222222-2222-2222-2222-222222222222', {
        policyIds: ['33333333-3333-3333-3333-333333333333', '55555555-5555-5555-5555-555555555555']
      });

      expect(insertStub).to.have.been.calledTwice;
      expect(insertStub.firstCall).to.have.been.calledWith({
        team_id: '22222222-2222-2222-2222-222222222222',
        policy_id: '33333333-3333-3333-3333-333333333333'
      });
      expect(insertStub.secondCall).to.have.been.calledWith({
        team_id: '22222222-2222-2222-2222-222222222222',
        policy_id: '55555555-5555-5555-5555-555555555555'
      });
      expect(result).to.eql([
        {
          team_policy_id: '11111111-1111-1111-1111-111111111111',
          team_id: '22222222-2222-2222-2222-222222222222',
          policy_id: '33333333-3333-3333-3333-333333333333'
        },
        {
          team_policy_id: '44444444-4444-4444-4444-444444444444',
          team_id: '22222222-2222-2222-2222-222222222222',
          policy_id: '55555555-5555-5555-5555-555555555555'
        }
      ]);
    });

    it('should skip policies that already exist and de-duplicate input policy ids', async () => {
      const getExistingStub = sinon.stub(TeamPolicyRepository.prototype, 'getPoliciesByTeamId').resolves([
        {
          team_policy_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          team_id: '22222222-2222-2222-2222-222222222222',
          policy_id: '33333333-3333-3333-3333-333333333333',
          team_name: 'Team 1',
          policy_name: 'Policy A'
        }
      ]);

      const insertStub = sinon.stub(TeamPolicyRepository.prototype, 'insertTeamPolicy').resolves({
        team_policy_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        team_id: '22222222-2222-2222-2222-222222222222',
        policy_id: '55555555-5555-5555-5555-555555555555'
      });
      sinon.stub(publisher, 'publishRefreshTeamFeatureCacheJob').resolves({ status: 'published', jobId: 'j1' });

      const result = await service.createTeamPolicies('22222222-2222-2222-2222-222222222222', [
        '33333333-3333-3333-3333-333333333333',
        '33333333-3333-3333-3333-333333333333',
        '55555555-5555-5555-5555-555555555555'
      ]);

      expect(getExistingStub).to.have.been.calledOnceWith('22222222-2222-2222-2222-222222222222', {
        policyIds: ['33333333-3333-3333-3333-333333333333', '55555555-5555-5555-5555-555555555555']
      });
      expect(insertStub).to.have.been.calledOnceWith({
        team_id: '22222222-2222-2222-2222-222222222222',
        policy_id: '55555555-5555-5555-5555-555555555555'
      });
      expect(result).to.eql([
        {
          team_policy_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          team_id: '22222222-2222-2222-2222-222222222222',
          policy_id: '55555555-5555-5555-5555-555555555555'
        }
      ]);
    });

    it('publishes cache refresh with the correct team ID', async () => {
      sinon.stub(TeamPolicyRepository.prototype, 'getPoliciesByTeamId').resolves([]);
      sinon.stub(TeamPolicyRepository.prototype, 'insertTeamPolicy').resolves({
        team_policy_id: '11111111-1111-1111-1111-111111111111',
        team_id: '22222222-2222-2222-2222-222222222222',
        policy_id: '33333333-3333-3333-3333-333333333333'
      });
      const publishStub = sinon
        .stub(publisher, 'publishRefreshTeamFeatureCacheJob')
        .resolves({ status: 'published', jobId: 'j1' });

      await service.createTeamPolicies('22222222-2222-2222-2222-222222222222', [
        '33333333-3333-3333-3333-333333333333'
      ]);

      expect(publishStub).to.have.been.calledOnce;
      expect(publishStub.firstCall.args[1]).to.eql({ teamId: '22222222-2222-2222-2222-222222222222' });
    });

    it('skips cache refresh when policyIds array is empty', async () => {
      const publishStub = sinon
        .stub(publisher, 'publishRefreshTeamFeatureCacheJob')
        .resolves({ status: 'published', jobId: 'j1' });

      const result = await service.createTeamPolicies('22222222-2222-2222-2222-222222222222', []);

      expect(publishStub).to.not.have.been.called;
      expect(result).to.eql([]);
    });
  });

  describe('getPoliciesByTeamId', () => {
    it('should call repository.getPoliciesByTeamId and return the records for a team', async () => {
      const mockTeamPolicies: TeamPolicyDetails[] = [
        {
          team_policy_id: '11111111-1111-1111-1111-111111111111',
          team_id: '22222222-2222-2222-2222-222222222222',
          policy_id: '33333333-3333-3333-3333-333333333333',
          team_name: 'Team 1',
          policy_name: 'Policy A'
        },
        {
          team_policy_id: '44444444-4444-4444-4444-444444444444',
          team_id: '22222222-2222-2222-2222-222222222222',
          policy_id: '55555555-5555-5555-5555-555555555555',
          team_name: 'Team 1',
          policy_name: 'Policy B'
        }
      ];

      const stub = sinon.stub(TeamPolicyRepository.prototype, 'getPoliciesByTeamId').resolves(mockTeamPolicies);

      const result = await service.getPoliciesByTeamId('22222222-2222-2222-2222-222222222222');

      expect(stub).to.have.been.calledWith('22222222-2222-2222-2222-222222222222');
      expect(result).to.eql(mockTeamPolicies);
    });
  });

  describe('getAllTeamPolicies', () => {
    it('should call repository.getTeamPolicies and return all team-policy associations with names', async () => {
      const mockTeamPolicies: TeamPolicyDetails[] = [
        {
          team_policy_id: '11111111-1111-1111-1111-111111111111',
          team_id: '22222222-2222-2222-2222-222222222222',
          policy_id: '33333333-3333-3333-3333-333333333333',
          team_name: 'Test Team',
          policy_name: 'Test Policy'
        }
      ];

      const stub = sinon.stub(TeamPolicyRepository.prototype, 'getTeamPolicies').resolves(mockTeamPolicies);

      const result = await service.getAllTeamPolicies();
      const filters = undefined;
      const pagination = undefined;

      expect(stub).to.have.been.calledOnce;
      expect(stub).to.have.been.calledWith(filters, pagination);
      expect(result).to.eql(mockTeamPolicies);
    });
  });

  describe('getAllTeamPoliciesCount', () => {
    it('should call repository.getAllTeamPoliciesCount and return count', async () => {
      const stub = sinon.stub(TeamPolicyRepository.prototype, 'getAllTeamPoliciesCount').resolves(2);
      const result = await service.getAllTeamPoliciesCount({ search: 'Team' });

      expect(stub).to.have.been.calledWith({ search: 'Team' });
      expect(result).to.equal(2);
    });
  });

  describe('updateTeamPolicy', () => {
    it('should call repository.updateTeamPolicy and return the updated record', async () => {
      const mockTeamPolicy: TeamPolicy = {
        team_policy_id: '11111111-1111-1111-1111-111111111111',
        team_id: '22222222-2222-2222-2222-222222222222',
        policy_id: '33333333-3333-3333-3333-333333333333'
      };

      const stub = sinon.stub(TeamPolicyRepository.prototype, 'updateTeamPolicy').resolves(mockTeamPolicy);

      const updateData: UpdateTeamPolicy = {
        record_end_date: '2025-12-31'
      };

      const result = await service.updateTeamPolicy('11111111-1111-1111-1111-111111111111', updateData);

      expect(stub).to.have.been.calledWith('11111111-1111-1111-1111-111111111111', updateData);
      expect(result).to.eql(mockTeamPolicy);
    });
  });

  describe('deleteTeamPolicy', () => {
    it('should call repository.deleteTeamPolicy', async () => {
      sinon.stub(TeamPolicyRepository.prototype, 'getTeamPolicy').resolves({
        team_policy_id: '11111111-1111-1111-1111-111111111111',
        team_id: '22222222-2222-2222-2222-222222222222',
        policy_id: '33333333-3333-3333-3333-333333333333'
      });
      const stub = sinon.stub(TeamPolicyRepository.prototype, 'deleteTeamPolicy').resolves();
      sinon.stub(publisher, 'publishRefreshTeamFeatureCacheJob').resolves({ status: 'published', jobId: 'j1' });

      await service.deleteTeamPolicy('11111111-1111-1111-1111-111111111111');

      expect(stub).to.have.been.calledWith('11111111-1111-1111-1111-111111111111');
    });

    it('fetches team_id before delete, then publishes cache refresh', async () => {
      const callOrder: string[] = [];

      sinon.stub(TeamPolicyRepository.prototype, 'getTeamPolicy').callsFake(async () => {
        callOrder.push('getTeamPolicy');
        return {
          team_policy_id: '11111111-1111-1111-1111-111111111111',
          team_id: '22222222-2222-2222-2222-222222222222',
          policy_id: '33333333-3333-3333-3333-333333333333'
        };
      });
      sinon.stub(TeamPolicyRepository.prototype, 'deleteTeamPolicy').callsFake(async () => {
        callOrder.push('delete');
      });
      sinon.stub(publisher, 'publishRefreshTeamFeatureCacheJob').callsFake(async () => {
        callOrder.push('publish');
        return { status: 'published', jobId: 'j1' };
      });

      await service.deleteTeamPolicy('11111111-1111-1111-1111-111111111111');

      // Verify ordering: fetch team_id → delete → publish cache refresh
      expect(callOrder).to.eql(['getTeamPolicy', 'delete', 'publish']);
    });

    it('publishes cache refresh for the correct team', async () => {
      sinon.stub(TeamPolicyRepository.prototype, 'getTeamPolicy').resolves({
        team_policy_id: '11111111-1111-1111-1111-111111111111',
        team_id: '22222222-2222-2222-2222-222222222222',
        policy_id: '33333333-3333-3333-3333-333333333333'
      });
      sinon.stub(TeamPolicyRepository.prototype, 'deleteTeamPolicy').resolves();
      const publishStub = sinon
        .stub(publisher, 'publishRefreshTeamFeatureCacheJob')
        .resolves({ status: 'published', jobId: 'j1' });

      await service.deleteTeamPolicy('11111111-1111-1111-1111-111111111111');

      expect(publishStub).to.have.been.calledOnce;
      expect(publishStub.firstCall.args[1]).to.eql({ teamId: '22222222-2222-2222-2222-222222222222' });
    });
  });
});
