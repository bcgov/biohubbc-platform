import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../../database/db';
import { TeamService } from '../../../../services/access-policy/team-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import { deleteTeam, getTeam, updateTeam } from './index';

chai.use(sinonChai);

describe('getTeam', () => {
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

    const requestHandler = getTeam();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as Error).message).to.equal('test error');
    }
  });

  it('should return 200 with team and members', async () => {
    const mockTeam = {
      team_id: 'team-1',
      name: 'Test Team',
      description: 'A test team',
      members: [{ team_member_id: 'tm-1', system_user_id: 1, user_identifier: 'alice' }]
    };

    const mockDBConnection = getMockDBConnection();
    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
    sinon.stub(TeamService.prototype, 'getTeamWithMembers').resolves(mockTeam);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { teamId: 'team-1' };

    const requestHandler = getTeam();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(mockTeam);
  });
});

describe('updateTeam', () => {
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
    mockReq.body = { name: 'Updated Team' };

    const requestHandler = updateTeam();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as Error).message).to.equal('test error');
    }
  });

  it('should return 200 with updated team', async () => {
    const mockTeam = {
      team_id: 'team-1',
      name: 'Updated Team',
      description: 'Updated description',
      members: []
    };

    const mockDBConnection = getMockDBConnection();
    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
    const updateStub = sinon.stub(TeamService.prototype, 'updateTeamWithMembers').resolves(mockTeam);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { teamId: 'team-1' };
    mockReq.body = { name: 'Updated Team', description: 'Updated description', member_user_ids: [] };

    const requestHandler = updateTeam();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(updateStub).to.have.been.calledWith(
      'team-1',
      { name: 'Updated Team', description: 'Updated description' },
      []
    );
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(mockTeam);
  });

  it('should default member_user_ids to empty array when not provided', async () => {
    const mockTeam = {
      team_id: 'team-1',
      name: 'Updated Team',
      description: null,
      members: []
    };

    const mockDBConnection = getMockDBConnection();
    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
    const updateStub = sinon.stub(TeamService.prototype, 'updateTeamWithMembers').resolves(mockTeam);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { teamId: 'team-1' };
    mockReq.body = { name: 'Updated Team' };

    const requestHandler = updateTeam();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(updateStub).to.have.been.calledWith('team-1', { name: 'Updated Team', description: undefined }, []);
  });
});

describe('deleteTeam', () => {
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

    const requestHandler = deleteTeam();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as Error).message).to.equal('test error');
    }
  });

  it('should return 200 on successful delete', async () => {
    const mockDBConnection = getMockDBConnection();
    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
    const deleteStub = sinon.stub(TeamService.prototype, 'deleteTeam').resolves();

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { teamId: 'team-1' };

    const requestHandler = deleteTeam();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(deleteStub).to.have.been.calledWith('team-1');
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql({ message: 'Team deleted successfully' });
  });
});
