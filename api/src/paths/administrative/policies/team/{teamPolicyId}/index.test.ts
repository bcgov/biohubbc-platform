import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../__mocks__/db';
import * as db from '../../../../../database/db';
import { TeamPolicyService } from '../../../../../services/access-policy/team-policy-service';
import { deletePolicyTeamAssignment } from './index';

chai.use(sinonChai);

describe('paths/administrative/policies/team/{teamPolicyId}/index', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('deletePolicyTeamAssignment', () => {
    it('should delete a team policy and return 204 on success', async () => {
      const mockDBConnection = getMockDBConnection();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.params = {
        teamPolicyId: '11111111-1111-1111-1111-111111111111'
      };

      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
      sinon.stub(TeamPolicyService.prototype, 'deleteTeamPolicy').resolves();

      const requestHandler = deletePolicyTeamAssignment();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockRes.statusValue).to.equal(204);
    });
  });
});
