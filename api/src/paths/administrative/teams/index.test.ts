import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import * as db from '../../../database/db';
import { Team } from '../../../models/team';
import { TeamService } from '../../../services/access-policy/team-service';
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
    const mockTeams: Team[] = [
      { team_id: '5d92f13c-fefa-49f3-9fb9-4e4611c67a34', name: 'Team Alpha', description: 'First', member_count: 0 }
    ];
    const mockResponse = {
      teams: mockTeams,
      pagination: { total: 1, per_page: 50, current_page: 1, last_page: 1, sort: undefined, order: undefined }
    };

    const mockDBConnection = getMockDBConnection();
    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
    sinon.stub(TeamService.prototype, 'getTeams').resolves(mockTeams);
    sinon.stub(TeamService.prototype, 'getTeamsCount').resolves(1);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.query = { page: '1', limit: '50' };

    const requestHandler = getTeams();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(mockResponse);
  });

  it('should filter by search parameter', async () => {
    const mockDBConnection = getMockDBConnection();
    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
    const getTeamsStub = sinon.stub(TeamService.prototype, 'getTeams').resolves([]);
    const getTeamsCountStub = sinon.stub(TeamService.prototype, 'getTeamsCount').resolves(0);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.query = { page: '1', limit: '50', search: 'Research' };

    const requestHandler = getTeams();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(getTeamsStub).to.have.been.calledWith(
      { search: 'Research' },
      {
        page: 1,
        limit: 50,
        sort: undefined,
        order: undefined
      }
    );
    expect(getTeamsCountStub).to.have.been.calledWith({ search: 'Research' });
  });

  it('should pass through limit from query params', async () => {
    const mockDBConnection = getMockDBConnection();
    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
    const getTeamsStub = sinon.stub(TeamService.prototype, 'getTeams').resolves([]);
    sinon.stub(TeamService.prototype, 'getTeamsCount').resolves(0);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.query = { page: '1', limit: '500' };

    const requestHandler = getTeams();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(getTeamsStub).to.have.been.calledWith(
      { search: undefined },
      {
        page: 1,
        limit: 500,
        sort: undefined,
        order: undefined
      }
    );
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
    const mockTeam: Team = {
      team_id: '5d92f13c-fefa-49f3-9fb9-4e4611c67a34',
      name: 'New Team',
      description: 'A new team',
      member_count: 0
    };

    const mockDBConnection = getMockDBConnection();
    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
    const createStub = sinon.stub(TeamService.prototype, 'createTeam').resolves(mockTeam);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.body = { name: 'New Team', description: 'A new team', system_user_ids: [] };

    const requestHandler = createTeam();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(createStub).to.have.been.calledWith({ name: 'New Team', description: 'A new team', system_user_ids: [] });
    expect(mockRes.statusValue).to.equal(201);
    expect(mockRes.jsonValue).to.eql(mockTeam);
  });

  it('should create team with members', async () => {
    const mockTeam: Team = {
      team_id: '5d92f13c-fefa-49f3-9fb9-4e4611c67a34',
      name: 'Team with Members',
      description: null,
      member_count: 1
    };

    const mockDBConnection = getMockDBConnection();
    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
    const createStub = sinon.stub(TeamService.prototype, 'createTeam').resolves(mockTeam);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.body = { name: 'Team with Members', system_user_ids: [1] };

    const requestHandler = createTeam();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(createStub).to.have.been.calledWith({
      name: 'Team with Members',
      description: undefined,
      system_user_ids: [1]
    });
    expect(mockRes.statusValue).to.equal(201);
  });
});
