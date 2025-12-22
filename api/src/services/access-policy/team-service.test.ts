import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { CreateTeam, Team, UpdateTeam } from '../../models/team';
import { TeamMember } from '../../models/team-member';
import { TeamMemberRepository, TeamMemberWithUser } from '../../repositories/authorization/team-member-repository';
import { TeamRepository } from '../../repositories/authorization/team-repository';
import { getMockDBConnection } from '../../__mocks__/db';
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

  describe('createTeam', () => {
    it('should call repository.insertTeam and return the created record', async () => {
      const mockTeam: Team = {
        team_id: '11111111-1111-1111-1111-111111111111',
        name: 'Engineering',
        description: 'Team description'
      };

      const stub = sinon.stub(TeamRepository.prototype, 'insertTeam').resolves(mockTeam);

      const input: CreateTeam = {
        name: 'Engineering',
        description: 'Team description'
      };

      const result = await service.createTeam(input);

      expect(stub).to.have.been.calledWith(input);
      expect(result).to.eql(mockTeam);
    });
  });

  describe('getTeam', () => {
    it('should call repository.getTeam and return the record', async () => {
      const mockTeam: Team = {
        team_id: '11111111-1111-1111-1111-111111111111',
        name: 'Engineering',
        description: 'Team description'
      };

      const stub = sinon.stub(TeamRepository.prototype, 'getTeam').resolves(mockTeam);

      const result = await service.getTeam('11111111-1111-1111-1111-111111111111');

      expect(stub).to.have.been.calledWith('11111111-1111-1111-1111-111111111111');
      expect(result).to.eql(mockTeam);
    });
  });

  describe('getTeams', () => {
    it('should call repository.getTeams and return all records', async () => {
      const mockTeams: Team[] = [
        {
          team_id: '11111111-1111-1111-1111-111111111111',
          name: 'Engineering',
          description: 'Team description'
        },
        {
          team_id: '22222222-2222-2222-2222-222222222222',
          name: 'Telemetry',
          description: 'Telemetry team description'
        }
      ];

      const stub = sinon.stub(TeamRepository.prototype, 'getTeams').resolves(mockTeams);

      const result = await service.getTeams();

      expect(stub).to.have.been.calledOnce;
      expect(result).to.eql(mockTeams);
    });
  });

  describe('updateTeam', () => {
    it('should call repository.updateTeam and return the updated record', async () => {
      const mockTeam: Team = {
        team_id: '11111111-1111-1111-1111-111111111111',
        name: 'Engineering',
        description: 'Team description'
      };

      const stub = sinon.stub(TeamRepository.prototype, 'updateTeam').resolves(mockTeam);

      const updateData: UpdateTeam = {
        name: 'Engineering',
        description: 'Team description'
      };

      const result = await service.updateTeam('11111111-1111-1111-1111-111111111111', updateData);

      expect(stub).to.have.been.calledWith('11111111-1111-1111-1111-111111111111', updateData);
      expect(result).to.eql(mockTeam);
    });
  });

  describe('deleteTeam', () => {
    it('should call repository.deleteTeam', async () => {
      const stub = sinon.stub(TeamRepository.prototype, 'deleteTeam').resolves();

      await service.deleteTeam('11111111-1111-1111-1111-111111111111');

      expect(stub).to.have.been.calledWith('11111111-1111-1111-1111-111111111111');
    });
  });

  describe('getTeamsWithMembers', () => {
    it('should return paginated teams with members', async () => {
      const mockTeams: Team[] = [
        { team_id: 'team-1', name: 'Team Alpha', description: 'First team' },
        { team_id: 'team-2', name: 'Team Beta', description: 'Second team' }
      ];
      const mockMembers: TeamMemberWithUser[] = [
        { team_member_id: 'tm-1', system_user_id: 1, user_identifier: 'alice' }
      ];

      sinon.stub(TeamRepository.prototype, 'getTeamsWithPagination').resolves({ teams: mockTeams, total: 2 });
      sinon.stub(service.connection, 'knex').resolves({ rows: mockMembers } as any);

      const result = await service.getTeamsWithMembers({ page: 1, limit: 50 });

      expect(result.pagination).to.eql({
        total: 2,
        current_page: 1,
        last_page: 1,
        per_page: 50,
        sort: undefined,
        order: undefined
      });
      expect(result.teams).to.have.length(2);
      expect(result.teams[0].members).to.eql(mockMembers);
    });

    it('should return empty array when no teams exist', async () => {
      sinon.stub(TeamRepository.prototype, 'getTeamsWithPagination').resolves({ teams: [], total: 0 });

      const result = await service.getTeamsWithMembers({ page: 1, limit: 50 });

      expect(result.teams).to.eql([]);
      expect(result.pagination).to.eql({
        total: 0,
        current_page: 1,
        last_page: 1,
        per_page: 50,
        sort: undefined,
        order: undefined
      });
    });
  });

  describe('getTeamWithMembers', () => {
    it('should return team with its members', async () => {
      const mockTeam: Team = { team_id: 'team-1', name: 'Test Team', description: 'A test team' };
      const mockMembers: TeamMemberWithUser[] = [{ team_member_id: 'tm-1', system_user_id: 1, user_identifier: 'bob' }];

      sinon.stub(TeamRepository.prototype, 'getTeam').resolves(mockTeam);
      sinon.stub(service.connection, 'knex').resolves({ rows: mockMembers } as any);

      const result = await service.getTeamWithMembers('team-1');

      expect(result).to.eql({ ...mockTeam, members: mockMembers });
    });
  });

  describe('createTeamWithMembers', () => {
    it('should create team and add members', async () => {
      const mockTeam: Team = { team_id: 'new-team', name: 'New Team', description: 'A new team' };
      const mockMembers: TeamMemberWithUser[] = [
        { team_member_id: 'tm-1', system_user_id: 1, user_identifier: 'alice' },
        { team_member_id: 'tm-2', system_user_id: 2, user_identifier: 'bob' }
      ];

      sinon.stub(TeamRepository.prototype, 'insertTeam').resolves(mockTeam);
      sinon.stub(TeamMemberRepository.prototype, 'insertTeamMember').resolves({} as TeamMember);
      sinon.stub(service.connection, 'knex').resolves({ rows: mockMembers } as any);

      const result = await service.createTeamWithMembers({ name: 'New Team', description: 'A new team' }, [1, 2]);

      expect(result.team_id).to.equal('new-team');
      expect(result.members).to.eql(mockMembers);
    });

    it('should create team with no members when none provided', async () => {
      const mockTeam: Team = { team_id: 'empty-team', name: 'Empty Team', description: null };

      sinon.stub(TeamRepository.prototype, 'insertTeam').resolves(mockTeam);
      sinon.stub(service.connection, 'knex').resolves({ rows: [] } as any);

      const result = await service.createTeamWithMembers({ name: 'Empty Team' }, []);

      expect(result.members).to.eql([]);
    });
  });

  describe('updateTeamWithMembers', () => {
    it('should update team and sync members', async () => {
      const mockTeam: Team = { team_id: 'team-1', name: 'Updated Team', description: 'Updated' };
      const existingMembers: TeamMember[] = [
        { team_member_id: 'tm-1', team_id: 'team-1', system_user_id: 1 },
        { team_member_id: 'tm-2', team_id: 'team-1', system_user_id: 2 }
      ];
      const newMembers: TeamMemberWithUser[] = [
        { team_member_id: 'tm-1', system_user_id: 1, user_identifier: 'alice' },
        { team_member_id: 'tm-3', system_user_id: 3, user_identifier: 'charlie' }
      ];

      sinon.stub(TeamRepository.prototype, 'updateTeam').resolves(mockTeam);
      sinon.stub(TeamMemberRepository.prototype, 'getTeamMembersByTeamId').resolves(existingMembers);
      const insertStub = sinon.stub(TeamMemberRepository.prototype, 'insertTeamMember').resolves({} as TeamMember);
      const deleteStub = sinon.stub(TeamMemberRepository.prototype, 'deleteTeamMember').resolves();
      sinon.stub(service.connection, 'knex').resolves({ rows: newMembers } as any);

      // Update with users 1 and 3 (remove 2, keep 1, add 3)
      const result = await service.updateTeamWithMembers(
        'team-1',
        { name: 'Updated Team', description: 'Updated' },
        [1, 3]
      );

      // Should add user 3 (new)
      expect(insertStub).to.have.been.calledOnce;
      // Should remove user 2 (no longer in list)
      expect(deleteStub).to.have.been.calledOnce;
      expect(result.members).to.eql(newMembers);
    });
  });
});
