import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../database/db';
import { TeamService } from '../../../services/access-policy/team-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import { createTeam, getTeams } from './index';

chai.use(sinonChai);

describe('getTeams', () => {
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
    mockReq.query = { page: '1', limit: '50' };

    const requestHandler = getTeams();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as Error).message).to.equal('test error');
    }
  });

  it('should return 200 with paginated teams', async () => {
    const mockTeams = {
      teams: [{ team_id: 'team-1', name: 'Team Alpha', description: 'First', members: [] }],
      pagination: { total: 1, current_page: 1, last_page: 1, per_page: 50 }
    };

    const mockDBConnection = getMockDBConnection();
    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
    sinon.stub(TeamService.prototype, 'getTeamsWithMembers').resolves(mockTeams);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.query = { page: '1', limit: '50' };

    const requestHandler = getTeams();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(mockTeams);
  });

  it('should filter by search parameter', async () => {
    const mockDBConnection = getMockDBConnection();
    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
    const getTeamsStub = sinon.stub(TeamService.prototype, 'getTeamsWithMembers').resolves({
      teams: [],
      pagination: { total: 0, current_page: 1, last_page: 1, per_page: 50 }
    });

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.query = { page: '1', limit: '50', search: 'Research' };

    const requestHandler = getTeams();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(getTeamsStub).to.have.been.calledWith({
      page: 1,
      limit: 50,
      sort: undefined,
      order: undefined,
      search: 'Research'
    });
  });

  it('should cap limit at 100', async () => {
    const mockDBConnection = getMockDBConnection();
    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
    const getTeamsStub = sinon.stub(TeamService.prototype, 'getTeamsWithMembers').resolves({
      teams: [],
      pagination: { total: 0, current_page: 1, last_page: 1, per_page: 100 }
    });

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.query = { page: '1', limit: '500' };

    const requestHandler = getTeams();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(getTeamsStub).to.have.been.calledWith({
      page: 1,
      limit: 100,
      sort: undefined,
      order: undefined,
      search: undefined
    });
  });
});

describe('createTeam', () => {
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
    mockReq.body = { name: 'New Team' };

    const requestHandler = createTeam();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as Error).message).to.equal('test error');
    }
  });

  it('should return 201 with created team', async () => {
    const mockTeam = {
      team_id: 'new-team',
      name: 'New Team',
      description: 'A new team',
      members: []
    };

    const mockDBConnection = getMockDBConnection();
    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
    sinon.stub(TeamService.prototype, 'createTeamWithMembers').resolves(mockTeam);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.body = { name: 'New Team', description: 'A new team', member_user_ids: [] };

    const requestHandler = createTeam();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockRes.statusValue).to.equal(201);
    expect(mockRes.jsonValue).to.eql(mockTeam);
  });

  it('should create team with members', async () => {
    const mockTeam = {
      team_id: 'new-team',
      name: 'Team with Members',
      description: null,
      members: [{ team_member_id: 'tm-1', system_user_id: 1, user_identifier: 'alice' }]
    };

    const mockDBConnection = getMockDBConnection();
    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
    const createStub = sinon.stub(TeamService.prototype, 'createTeamWithMembers').resolves(mockTeam);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.body = { name: 'Team with Members', member_user_ids: [1] };

    const requestHandler = createTeam();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(createStub).to.have.been.calledWith({ name: 'Team with Members', description: undefined }, [1]);
    expect(mockRes.statusValue).to.equal(201);
  });

  it('should default member_user_ids to empty array when not provided', async () => {
    const mockTeam = {
      team_id: 'new-team',
      name: 'Empty Team',
      description: null,
      members: []
    };

    const mockDBConnection = getMockDBConnection();
    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
    const createStub = sinon.stub(TeamService.prototype, 'createTeamWithMembers').resolves(mockTeam);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.body = { name: 'Empty Team' };

    const requestHandler = createTeam();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(createStub).to.have.been.calledWith({ name: 'Empty Team', description: undefined }, []);
  });
});
