import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../__mocks__/db';
import * as db from '../../../../../database/db';
import { TeamMemberWithUser } from '../../../../../models/team-member';
import { TeamMemberService } from '../../../../../services/access-policy/team-member-service';
import { createTeamMember, deleteAllTeamMembers, getTeamMembers } from './index';

chai.use(sinonChai);

describe('getTeamMembers', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('re-throws any error that is thrown', async () => {
    const mockDBConnection = getMockDBConnection({
      open: () => {
        throw new Error('test error');
      }
    });

    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { teamId: 'team-1' };
    mockReq.query = { page: '1', limit: '50' };

    const requestHandler = getTeamMembers();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as Error).message).to.equal('test error');
    }
  });

  it('should return 200 with paginated team members', async () => {
    const mockMembers: TeamMemberWithUser[] = [
      { team_member_id: 'tm-1', system_user_id: 1, user_identifier: 'alice', email: 'a@test.com' }
    ];
    const mockResponse = {
      members: mockMembers,
      pagination: { total: 1, per_page: 50, current_page: 1, last_page: 1, sort: undefined, order: undefined }
    };

    const mockDBConnection = getMockDBConnection();
    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
    const getMembersStub = sinon.stub(TeamMemberService.prototype, 'getTeamMembersWithUsers').resolves(mockMembers);
    const getMembersCountStub = sinon.stub(TeamMemberService.prototype, 'getTeamMembersWithUsersCount').resolves(1);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { teamId: 'team-1' };
    mockReq.query = { page: '1', limit: '50' };

    const requestHandler = getTeamMembers();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(getMembersStub).to.have.been.calledWith('team-1', {
      page: 1,
      limit: 50,
      sort: undefined,
      order: undefined
    });
    expect(getMembersCountStub).to.have.been.calledWith('team-1');
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(mockResponse);
  });

  it('should add team member', async () => {
    const mockDBConnection = getMockDBConnection();
    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
    const createdTeamMember: TeamMemberWithUser = {
      team_member_id: 'tm-1',
      system_user_id: 42,
      user_identifier: 'user_42',
      email: 'user_42@test.com'
    };
    const createStub = sinon.stub(TeamMemberService.prototype, 'createTeamMember').resolves(createdTeamMember);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { teamId: 'team-1' };
    mockReq.body = { system_user_id: 42 };

    const requestHandler = createTeamMember();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(createStub).to.have.been.calledOnceWith({ team_id: 'team-1', system_user_id: 42 });
    expect(mockRes.statusValue).to.equal(201);
    expect(mockRes.jsonValue).to.eql({
      team_member_id: 'tm-1',
      system_user_id: 42,
      user_identifier: 'user_42',
      email: 'user_42@test.com'
    });
  });

  it('should delete all team members for a team', async () => {
    const mockDBConnection = getMockDBConnection();
    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

    // Stub the new service method
    const deleteAllStub = sinon.stub(TeamMemberService.prototype, 'deleteAllTeamMembers').resolves();

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { teamId: 'team-1' };

    const requestHandler = deleteAllTeamMembers();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(deleteAllStub).to.have.been.calledOnceWith('team-1');
    expect(mockRes.statusValue).to.equal(204);
  });
});
