import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import { IDBConnection } from '../../database/db';
import { Team } from '../../models/team';
import { TeamMember, TeamMemberWithUser } from '../../models/team-member';
import { TeamRepository } from '../../repositories/authorization/team-repository';
import { SecurityScopeService } from './security-scope-service';
import { TeamMemberService } from './team-member-service';
import { TeamService } from './team-service';

chai.use(sinonChai);

describe('TeamService', () => {
  let mockDBConnection: IDBConnection;
  let service: TeamService;

  beforeEach(() => {
    mockDBConnection = getMockDBConnection();
    service = new TeamService(mockDBConnection);
  });

  afterEach(() => {
    sinon.restore();
  });

  it('createTeam inserts team and returns refreshed team', async () => {
    const mockTeam: Team = {
      team_id: '11111111-1111-1111-1111-111111111111',
      name: 'Engineering',
      description: 'Team description',
      member_count: 0
    };

    const insertStub = sinon.stub(TeamRepository.prototype, 'insertTeam').resolves(mockTeam);
    const getStub = sinon.stub(TeamRepository.prototype, 'getTeam').resolves(mockTeam);
    const result = await service.createTeam({ name: 'Engineering', description: 'Team description' });

    expect(insertStub).to.have.been.calledWith({ name: 'Engineering', description: 'Team description' });
    expect(getStub).to.have.been.calledWith('11111111-1111-1111-1111-111111111111');
    expect(result).to.eql(mockTeam);
  });

  it('createTeam creates team members when system_user_ids are provided', async () => {
    const insertedTeam: Team = {
      team_id: '11111111-1111-1111-1111-111111111111',
      name: 'Engineering',
      description: 'Team description',
      member_count: 0
    };

    const refreshedTeam: Team = {
      ...insertedTeam,
      member_count: 2
    };

    const createdMember: TeamMemberWithUser = {
      team_member_id: '22222222-2222-2222-2222-222222222222',
      system_user_id: 1,
      user_identifier: 'user_1',
      email: 'user_1@test.com'
    };

    sinon.stub(TeamRepository.prototype, 'insertTeam').resolves(insertedTeam);
    const getTeamStub = sinon.stub(TeamRepository.prototype, 'getTeam').resolves(refreshedTeam);
    const createTeamMemberStub = sinon.stub(TeamMemberService.prototype, 'createTeamMember').resolves(createdMember);

    const result = await service.createTeam({
      name: 'Engineering',
      description: 'Team description',
      system_user_ids: [1, 2]
    });

    expect(createTeamMemberStub).to.have.been.calledTwice;
    expect(createTeamMemberStub.firstCall).to.have.been.calledWith({
      team_id: '11111111-1111-1111-1111-111111111111',
      system_user_id: 1
    });
    expect(createTeamMemberStub.secondCall).to.have.been.calledWith({
      team_id: '11111111-1111-1111-1111-111111111111',
      system_user_id: 2
    });
    expect(getTeamStub).to.have.been.calledWith('11111111-1111-1111-1111-111111111111');
    expect(result).to.eql(refreshedTeam);
  });

  it('getTeam calls repository.getTeam', async () => {
    const mockTeam: Team = {
      team_id: '11111111-1111-1111-1111-111111111111',
      name: 'Engineering',
      description: 'Team description',
      member_count: 2
    };

    const stub = sinon.stub(TeamRepository.prototype, 'getTeam').resolves(mockTeam);
    const result = await service.getTeam('11111111-1111-1111-1111-111111111111');

    expect(stub).to.have.been.calledWith('11111111-1111-1111-1111-111111111111');
    expect(result).to.eql(mockTeam);
  });

  it('getTeams without pagination returns array', async () => {
    const mockTeams: Team[] = [
      {
        team_id: '11111111-1111-1111-1111-111111111111',
        name: 'Engineering',
        description: 'Team description',
        member_count: 1
      }
    ];

    const stub = sinon.stub(TeamRepository.prototype, 'getTeams').resolves(mockTeams);
    const result = await service.getTeams();
    const filters = undefined;
    const pagination = undefined;

    expect(stub).to.have.been.calledOnce;
    expect(stub).to.have.been.calledWith(filters, pagination);
    expect(result).to.eql(mockTeams);
  });

  it('getTeams with pagination returns array', async () => {
    const mockTeams: Team[] = [
      {
        team_id: '11111111-1111-1111-1111-111111111111',
        name: 'Engineering',
        description: 'Team description',
        member_count: 1
      }
    ];

    const getTeamsStub = sinon.stub(TeamRepository.prototype, 'getTeams').resolves(mockTeams);
    const result = await service.getTeams({ search: 'Eng' }, { page: 1, limit: 50 });

    expect(getTeamsStub).to.have.been.calledWith({ search: 'Eng' }, { page: 1, limit: 50 });
    expect(result).to.eql(mockTeams);
  });

  it('getTeamsCount calls repository.getTeamsCount', async () => {
    const stub = sinon.stub(TeamRepository.prototype, 'getTeamsCount').resolves(3);
    const result = await service.getTeamsCount({ search: 'Eng' });

    expect(stub).to.have.been.calledWith({ search: 'Eng' });
    expect(result).to.equal(3);
  });

  it('updateTeam syncs members — adds new, removes absent, keeps existing', async () => {
    const teamId = '11111111-1111-1111-1111-111111111111';
    const mockTeam: Team = { team_id: teamId, name: 'Engineering', description: 'Team description', member_count: 2 };

    // Current members: 101 and 102. Desired: 102 and 103.
    // Expected: remove 101, keep 102, add 103.
    const currentMembers: TeamMember[] = [
      { team_member_id: 'aaaa-aaaa', system_user_id: 101, team_id: teamId },
      { team_member_id: 'bbbb-bbbb', system_user_id: 102, team_id: teamId }
    ];

    const updateStub = sinon.stub(TeamRepository.prototype, 'updateTeam').resolves();
    const getStub = sinon.stub(TeamRepository.prototype, 'getTeam').resolves(mockTeam);
    const getMembersStub = sinon.stub(TeamMemberService.prototype, 'getTeamMembers').resolves(currentMembers);
    const createMemberStub = sinon.stub(TeamMemberService.prototype, 'createTeamMember').resolves();
    const deleteMemberStub = sinon.stub(TeamMemberService.prototype, 'deleteTeamMemberByUser').resolves();

    const result = await service.updateTeam(teamId, {
      name: 'Engineering',
      description: 'Team description',
      system_user_ids: [102, 103]
    });

    expect(updateStub).to.have.been.calledOnce;
    expect(getMembersStub).to.have.been.calledWith(teamId);

    // 101 removed
    expect(deleteMemberStub).to.have.been.calledOnce;
    expect(deleteMemberStub).to.have.been.calledWith({ team_id: teamId, system_user_id: 101 });

    // 103 added (102 already exists, not re-added)
    expect(createMemberStub).to.have.been.calledOnce;
    expect(createMemberStub).to.have.been.calledWith({ team_id: teamId, system_user_id: 103 });

    expect(getStub).to.have.been.calledWith(teamId);
    expect(result).to.eql(mockTeam);
  });

  it('updateTeam skips member sync when system_user_ids is not provided', async () => {
    const teamId = '11111111-1111-1111-1111-111111111111';
    const mockTeam: Team = { team_id: teamId, name: 'Renamed', description: 'desc', member_count: 1 };

    const updateStub = sinon.stub(TeamRepository.prototype, 'updateTeam').resolves();
    const getStub = sinon.stub(TeamRepository.prototype, 'getTeam').resolves(mockTeam);
    const getMembersStub = sinon.stub(TeamMemberService.prototype, 'getTeamMembers');
    const createMemberStub = sinon.stub(TeamMemberService.prototype, 'createTeamMember');
    const deleteMemberStub = sinon.stub(TeamMemberService.prototype, 'deleteTeamMemberByUser');

    const result = await service.updateTeam(teamId, { name: 'Renamed', description: 'desc' });

    expect(updateStub).to.have.been.calledOnce;
    expect(getMembersStub).to.not.have.been.called;
    expect(createMemberStub).to.not.have.been.called;
    expect(deleteMemberStub).to.not.have.been.called;
    expect(getStub).to.have.been.calledWith(teamId);
    expect(result).to.eql(mockTeam);
  });

  it('deleteTeam calls repository.deleteTeam and rebuilds team security scopes', async () => {
    const stub = sinon.stub(TeamRepository.prototype, 'deleteTeam').resolves();
    const rebuildStub = sinon.stub(SecurityScopeService.prototype, 'rebuildTeamSecurityScopes').resolves();

    await service.deleteTeam('11111111-1111-1111-1111-111111111111');

    expect(stub).to.have.been.calledWith('11111111-1111-1111-1111-111111111111');
    expect(rebuildStub).to.have.been.calledOnceWith('11111111-1111-1111-1111-111111111111');
  });
});
