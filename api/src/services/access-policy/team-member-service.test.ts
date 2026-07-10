import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import {
  CreateTeamMember,
  TeamMember,
  TeamMemberByUserFilter,
  TeamMemberWithUser,
  UpdateTeamMember
} from '../../models/team-member';
import { TeamMemberRepository } from '../../repositories/authorization/team-member-repository';
import { TeamMemberService } from './team-member-service';

chai.use(sinonChai);

describe('TeamMemberService', () => {
  let mockDBConnection: any;
  let service: TeamMemberService;

  beforeEach(() => {
    mockDBConnection = getMockDBConnection();
    service = new TeamMemberService(mockDBConnection);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('createTeamMember', () => {
    it('should call repository.insertTeamMember and return the created record', async () => {
      const mockTeamMember: TeamMember = {
        team_member_id: '11111111-1111-1111-1111-111111111111',
        system_user_id: 1,
        team_id: '22222222-2222-2222-2222-222222222222'
      };
      const mockTeamMemberWithUser: TeamMemberWithUser = {
        team_member_id: '11111111-1111-1111-1111-111111111111',
        system_user_id: 1,
        user_identifier: 'user_1',
        display_name: 'User, One WLRS:EX',
        email: 'user_1@test.com'
      };

      const getWithUserStub = sinon
        .stub(TeamMemberRepository.prototype, 'getTeamMemberWithUser')
        .onFirstCall()
        .resolves(null)
        .onSecondCall()
        .resolves(mockTeamMemberWithUser);
      const insertStub = sinon.stub(TeamMemberRepository.prototype, 'insertTeamMember').resolves(mockTeamMember);

      const input: CreateTeamMember = {
        system_user_id: 1,
        team_id: '22222222-2222-2222-2222-222222222222'
      };

      const result = await service.createTeamMember(input);

      expect(insertStub).to.have.been.calledWith(input);
      expect(getWithUserStub).to.have.been.calledWith({
        team_id: '22222222-2222-2222-2222-222222222222',
        system_user_id: 1
      });
      expect(result).to.eql(mockTeamMemberWithUser);
    });

    it('should return existing team member when association already exists', async () => {
      const existingTeamMember: TeamMemberWithUser = {
        team_member_id: '11111111-1111-1111-1111-111111111111',
        system_user_id: 1,
        user_identifier: 'user_1',
        display_name: 'User, One WLRS:EX',
        email: 'user_1@test.com'
      };

      sinon.stub(TeamMemberRepository.prototype, 'getTeamMemberWithUser').resolves(existingTeamMember);
      const insertStub = sinon.stub(TeamMemberRepository.prototype, 'insertTeamMember').resolves({} as TeamMember);

      const input: CreateTeamMember = {
        system_user_id: 1,
        team_id: '22222222-2222-2222-2222-222222222222'
      };

      const result = await service.createTeamMember(input);

      expect(insertStub).to.not.have.been.called;
      expect(result).to.eql(existingTeamMember);
    });
  });

  describe('getTeamMember', () => {
    it('should call repository.getTeamMember and return the record', async () => {
      const mockTeamMember: TeamMember = {
        team_member_id: '11111111-1111-1111-1111-111111111111',
        system_user_id: 2,
        team_id: '22222222-2222-2222-2222-222222222222'
      };

      const stub = sinon.stub(TeamMemberRepository.prototype, 'getTeamMember').resolves(mockTeamMember);

      const result = await service.getTeamMember('11111111-1111-1111-1111-111111111111');

      expect(stub).to.have.been.calledWith('11111111-1111-1111-1111-111111111111');
      expect(result).to.eql(mockTeamMember);
    });
  });

  describe('getTeamMembers', () => {
    it('should call repository.getTeamMembersByTeamId and return the list of team members', async () => {
      const mockTeamMembers: TeamMember[] = [
        {
          team_member_id: '11111111-1111-1111-1111-111111111111',
          system_user_id: 2,
          team_id: '22222222-2222-2222-2222-222222222222'
        },
        {
          team_member_id: '33333333-3333-3333-3333-333333333333',
          system_user_id: 3,
          team_id: '22222222-2222-2222-2222-222222222222'
        }
      ];

      const stub = sinon.stub(TeamMemberRepository.prototype, 'getTeamMembersByTeamId').resolves(mockTeamMembers);

      const result = await service.getTeamMembers('22222222-2222-2222-2222-222222222222');

      expect(stub).to.have.been.calledWith('22222222-2222-2222-2222-222222222222');
      expect(result).to.eql(mockTeamMembers);
    });
  });

  describe('getTeamIdsBySystemUserId', () => {
    it("returns team IDs derived from the user's active team memberships", async () => {
      const mockMembers: TeamMember[] = [
        { team_member_id: '11111111-1111-1111-1111-111111111111', system_user_id: 5, team_id: 'team-a' },
        { team_member_id: '22222222-2222-2222-2222-222222222222', system_user_id: 5, team_id: 'team-b' }
      ];
      const stub = sinon.stub(TeamMemberRepository.prototype, 'getTeamMembersBySystemUserId').resolves(mockMembers);

      const result = await service.getTeamIdsBySystemUserId(5);

      expect(stub).to.have.been.calledWith(5);
      expect(result).to.eql(['team-a', 'team-b']);
    });

    it('returns empty array when user has no active team memberships', async () => {
      sinon.stub(TeamMemberRepository.prototype, 'getTeamMembersBySystemUserId').resolves([]);

      const result = await service.getTeamIdsBySystemUserId(99);

      expect(result).to.eql([]);
    });
  });

  describe('updateTeamMember', () => {
    it('should call repository.updateTeamMember and return the updated record', async () => {
      const mockTeamMember: TeamMember = {
        team_member_id: '11111111-1111-1111-1111-111111111111',
        system_user_id: 2,
        team_id: '22222222-2222-2222-2222-222222222222'
      };

      const stub = sinon.stub(TeamMemberRepository.prototype, 'updateTeamMember').resolves(mockTeamMember);

      const updateData: UpdateTeamMember = {
        record_end_date: '2025-12-31'
      };

      const result = await service.updateTeamMember('11111111-1111-1111-1111-111111111111', updateData);

      expect(stub).to.have.been.calledWith('11111111-1111-1111-1111-111111111111', updateData);
      expect(result).to.eql(mockTeamMember);
    });
  });

  describe('deleteTeamMember', () => {
    it('should call repository.deleteTeamMember when teamMemberId is provided', async () => {
      const deleteStub = sinon.stub(TeamMemberRepository.prototype, 'deleteTeamMember').resolves();

      await service.deleteTeamMember('11111111-1111-1111-1111-111111111111');

      expect(deleteStub).to.have.been.calledWith('11111111-1111-1111-1111-111111111111');
    });

    it('should find and delete by teamId and systemUserId', async () => {
      const teamMemberFilter: TeamMemberByUserFilter = {
        team_id: '22222222-2222-2222-2222-222222222222',
        system_user_id: 2
      };
      sinon.stub(TeamMemberRepository.prototype, 'getTeamMemberByTeamAndUser').resolves({
        team_member_id: '11111111-1111-1111-1111-111111111111',
        system_user_id: 2,
        team_id: '22222222-2222-2222-2222-222222222222'
      });
      const deleteStub = sinon.stub(TeamMemberRepository.prototype, 'deleteTeamMember').resolves();

      await service.deleteTeamMemberByUser(teamMemberFilter);

      expect(deleteStub).to.have.been.calledWith('11111111-1111-1111-1111-111111111111');
    });

    it('should no-op when deleting by teamId and systemUserId if no member exists', async () => {
      const teamMemberFilter: TeamMemberByUserFilter = {
        team_id: '22222222-2222-2222-2222-222222222222',
        system_user_id: 2
      };
      sinon.stub(TeamMemberRepository.prototype, 'getTeamMemberByTeamAndUser').resolves(null);
      const deleteStub = sinon.stub(TeamMemberRepository.prototype, 'deleteTeamMember').resolves();

      await service.deleteTeamMemberByUser(teamMemberFilter);

      expect(deleteStub).to.not.have.been.called;
    });
  });
});
