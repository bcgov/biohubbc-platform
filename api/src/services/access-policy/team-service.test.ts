import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { CreateTeam, Team, UpdateTeam } from '../../models/team';
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
});
