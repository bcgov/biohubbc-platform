import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import * as db from '../../../../database/db';
import { TeamPolicyService } from '../../../../services/access-policy/team-policy-service';
import * as teamPolicyEndpoint from './index';

chai.use(sinonChai);

describe('team-policies/{teamPolicyId}', () => {
  describe('deleteTeamPolicy', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should delete a team policy and return 204 on success', async () => {
      const mockDBConnection = getMockDBConnection();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.params = {
        teamPolicyId: '11111111-1111-1111-1111-111111111111'
      };

      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
      sinon.stub(TeamPolicyService.prototype, 'deleteTeamPolicy').resolves();

      const requestHandler = teamPolicyEndpoint.deleteTeamPolicy();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockRes.statusValue).to.equal(204);
    });
  });
});
