import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { CreateTeamMember, TeamMember, UpdateTeamMember } from '../../models/team-member';
import { TeamMemberRepository } from '../../repositories/authorization/team-member-repository';
import { getMockDBConnection } from '../../__mocks__/db';
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

      const stub = sinon.stub(TeamMemberRepository.prototype, 'insertTeamMember').resolves(mockTeamMember);

      const input: CreateTeamMember = {
        system_user_id: 1,
        team_id: '22222222-2222-2222-2222-222222222222'
      };

      const result = await service.createTeamMember(input);

      expect(stub).to.have.been.calledWith(input);
      expect(result).to.eql(mockTeamMember);
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
    it('should call repository.deleteTeamMember', async () => {
      const stub = sinon.stub(TeamMemberRepository.prototype, 'deleteTeamMember').resolves();

      await service.deleteTeamMember('11111111-1111-1111-1111-111111111111');

      expect(stub).to.have.been.calledWith('11111111-1111-1111-1111-111111111111');
    });
  });
});
