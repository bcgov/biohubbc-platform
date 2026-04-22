import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import * as db from '../../../../database/db';
import { Team } from '../../../../models/team';
import { TeamService } from '../../../../services/access-policy/team-service';
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

    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);

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

  it('should return 200 with team details', async () => {
    const mockTeam: Team = {
      team_id: '5d92f13c-fefa-49f3-9fb9-4e4611c67a34',
      name: 'Test Team',
      description: 'A test team',
      member_count: 1
    };

    const mockDBConnection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
    sinon.stub(TeamService.prototype, 'getTeam').resolves(mockTeam);

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

    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { teamId: 'team-1' };
    mockReq.body = { name: 'Updated Team' };

    const requestHandler = updateTeam();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail('Expected error to be thrown');
    } catch (actualError) {
      expect((actualError as Error).message).to.equal('test error');
    }
  });

  it('should return 200 with updated team', async () => {
    const mockTeam: Team = {
      team_id: '5d92f13c-fefa-49f3-9fb9-4e4611c67a34',
      name: 'Updated Team',
      description: 'Updated description',
      member_count: 0
    };

    const mockDBConnection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
    const updateStub = sinon.stub(TeamService.prototype, 'updateTeam').resolves(mockTeam);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { teamId: 'team-1' };
    mockReq.body = { name: 'Updated Team', description: 'Updated description', system_user_ids: [1, 2] };

    const requestHandler = updateTeam();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(updateStub).to.have.been.calledWith('team-1', {
      name: 'Updated Team',
      description: 'Updated description',
      system_user_ids: [1, 2]
    });
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(mockTeam);
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

    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);

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
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
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
