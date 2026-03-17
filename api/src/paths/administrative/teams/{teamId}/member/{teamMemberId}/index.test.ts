import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../../../../database/db';
import { TeamMemberService } from '../../../../../../services/access-policy/team-member-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../../__mocks__/db';
import { deleteTeamMember } from './index';

chai.use(sinonChai);

describe('teams/{teamId}/member/{teamMemberId}', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('should delete a team member', async () => {
    const mockDBConnection = getMockDBConnection();
    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
    const deleteStub = sinon.stub(TeamMemberService.prototype, 'deleteTeamMember').resolves();

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { teamId: 'team-1', teamMemberId: 'tm-1' };

    const requestHandler = deleteTeamMember();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(deleteStub).to.have.been.calledOnceWith('tm-1');
    expect(mockRes.statusValue).to.equal(204);
  });
});
