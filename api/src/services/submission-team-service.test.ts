import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { IDBConnection } from '../database/db';
import { SubmissionTeam } from '../models/submission-team';
import { Team } from '../models/team';
import { TeamMemberWithUser } from '../models/team-member';
import { SubmissionTeamRepository } from '../repositories/submission-team-repository';
import { TeamMemberService } from './access-policy/team-member-service';
import { TeamService } from './access-policy/team-service';
import { SubmissionTeamService } from './submission-team-service';

chai.use(sinonChai);

describe('SubmissionTeamService', () => {
  let mockDBConnection: IDBConnection;
  let service: SubmissionTeamService;
  let sqlStub: sinon.SinonStub;

  beforeEach(() => {
    sqlStub = sinon.stub().resolves({ rows: [], rowCount: 0 });
    mockDBConnection = getMockDBConnection({ sql: sqlStub });
    service = new SubmissionTeamService(mockDBConnection);
  });

  afterEach(() => {
    sinon.restore();
  });

  const ownerTeam: Team = {
    team_id: '11111111-1111-1111-1111-111111111111',
    name: 'Submission Owner 7',
    description: 'desc',
    member_count: 1
  };

  const mockLink: SubmissionTeam = {
    submission_team_id: 1,
    submission_id: 10,
    team_id: ownerTeam.team_id
  };

  describe('grantSubmissionAccessToUser', () => {
    it('creates the owner team when it does not exist, then links the submission', async () => {
      const getTeamByNameStub = sinon.stub(TeamService.prototype, 'getTeamByName').resolves(null);
      const createTeamStub = sinon.stub(TeamService.prototype, 'createTeam').resolves(ownerTeam);
      const createMemberStub = sinon.stub(TeamMemberService.prototype, 'createTeamMember');
      const insertLinkStub = sinon.stub(SubmissionTeamRepository.prototype, 'insertSubmissionTeam').resolves(mockLink);

      await service.grantSubmissionAccessToUser(10, 7);

      // Acquires a per-user advisory lock before the find-or-create to avoid concurrent races.
      expect(sqlStub.firstCall.args[0].text).to.contain('pg_advisory_xact_lock');
      expect(getTeamByNameStub).to.have.been.calledWith('Submission Owner 7');
      expect(createTeamStub).to.have.been.calledWithMatch({
        name: 'Submission Owner 7',
        system_user_ids: [7]
      });
      // No separate membership call needed; createTeam already adds the member.
      expect(createMemberStub).to.not.have.been.called;
      expect(insertLinkStub).to.have.been.calledWith({ submission_id: 10, team_id: ownerTeam.team_id });
    });

    it('reuses the existing owner team and ensures membership, then links the submission', async () => {
      const getTeamByNameStub = sinon.stub(TeamService.prototype, 'getTeamByName').resolves(ownerTeam);
      const createTeamStub = sinon.stub(TeamService.prototype, 'createTeam');
      const createMemberStub = sinon
        .stub(TeamMemberService.prototype, 'createTeamMember')
        .resolves({} as TeamMemberWithUser);
      const insertLinkStub = sinon.stub(SubmissionTeamRepository.prototype, 'insertSubmissionTeam').resolves(mockLink);

      await service.grantSubmissionAccessToUser(10, 7);

      expect(getTeamByNameStub).to.have.been.calledWith('Submission Owner 7');
      expect(createTeamStub).to.not.have.been.called;
      expect(createMemberStub).to.have.been.calledWith({ team_id: ownerTeam.team_id, system_user_id: 7 });
      expect(insertLinkStub).to.have.been.calledWith({ submission_id: 10, team_id: ownerTeam.team_id });
    });

    it('is idempotent when the link already exists (repository returns null)', async () => {
      sinon.stub(TeamService.prototype, 'getTeamByName').resolves(ownerTeam);
      sinon.stub(TeamMemberService.prototype, 'createTeamMember').resolves({} as TeamMemberWithUser);
      const insertLinkStub = sinon.stub(SubmissionTeamRepository.prototype, 'insertSubmissionTeam').resolves(null);

      await service.grantSubmissionAccessToUser(10, 7);

      expect(insertLinkStub).to.have.been.calledOnce;
    });
  });
});
