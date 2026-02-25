import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { Team } from '../../models/team';
import { TeamMemberWithUser } from '../../repositories/authorization/team-member-repository';
import { TeamRepository } from '../../repositories/authorization/team-repository';
import { getMockDBConnection } from '../../__mocks__/db';
import { TeamMemberService } from './team-member-service';
import { TeamService } from './team-service';

chai.use(sinonChai);

describe('TeamService', () => {
  let mockDBConnection: any;
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

  it('updateTeam calls repository.updateTeam and then getTeam', async () => {
    const mockTeam: Team = {
      team_id: '11111111-1111-1111-1111-111111111111',
      name: 'Engineering',
      description: 'Team description',
      member_count: 2
    };

    const updateStub = sinon.stub(TeamRepository.prototype, 'updateTeam').resolves();
    const getStub = sinon.stub(TeamRepository.prototype, 'getTeam').resolves(mockTeam);

    const result = await service.updateTeam('11111111-1111-1111-1111-111111111111', {
      name: 'Engineering',
      description: 'Team description'
    });

    expect(updateStub).to.have.been.calledWith('11111111-1111-1111-1111-111111111111', {
      name: 'Engineering',
      description: 'Team description'
    });
    expect(getStub).to.have.been.calledWith('11111111-1111-1111-1111-111111111111');
    expect(result).to.eql(mockTeam);
  });

  it('deleteTeam calls repository.deleteTeam', async () => {
    const stub = sinon.stub(TeamRepository.prototype, 'deleteTeam').resolves();
    await service.deleteTeam('11111111-1111-1111-1111-111111111111');
    expect(stub).to.have.been.calledWith('11111111-1111-1111-1111-111111111111');
  });
});
