import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../__mocks__/db';
import * as db from '../../../../../database/db';
import { SecurityReason } from '../../../../../models/security-rule';
import { SecurityService } from '../../../../../services/security-service';
import { deleteSecurityReason, getSecurityReason, updateSecurityReason } from './index';

chai.use(sinonChai);

describe('administrative/security/reasons/{securityRuleId}', () => {
  afterEach(() => {
    sinon.restore();
  });

  const mockReason: SecurityReason = {
    security_rule_id: 1,
    security_category_id: 2,
    name: 'Research',
    description: 'Research reason'
  };

  describe('GET/getSecurityReason', () => {
    it('returns 200 with reason details', async () => {
      const mockDBConnection = getMockDBConnection();
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
      sinon.stub(SecurityService.prototype, 'getSecurityReason').resolves(mockReason);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params = { securityRuleId: '1' };

      await getSecurityReason()(mockReq, mockRes, mockNext);

      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql(mockReason);
    });
  });

  describe('PUT/updateSecurityReason', () => {
    it('returns 200 with updated reason', async () => {
      const updatedReason = { ...mockReason, name: 'Updated' };
      const mockDBConnection = getMockDBConnection();
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
      sinon.stub(SecurityService.prototype, 'updateSecurityReason').resolves(updatedReason);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params = { securityRuleId: '1' };
      mockReq.body = { name: 'Updated', description: 'Research reason', security_category_id: 2 };

      await updateSecurityReason()(mockReq, mockRes, mockNext);

      expect(SecurityService.prototype.updateSecurityReason).to.have.been.calledOnceWith(1, {
        name: 'Updated',
        description: 'Research reason',
        security_category_id: 2
      });
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql(updatedReason);
    });
  });

  describe('DELETE/deleteSecurityReason', () => {
    it('returns 200 when reason is deleted', async () => {
      const mockDBConnection = getMockDBConnection();
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
      sinon.stub(SecurityService.prototype, 'deleteSecurityReason').resolves();

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params = { securityRuleId: '1' };

      await deleteSecurityReason()(mockReq, mockRes, mockNext);

      expect(SecurityService.prototype.deleteSecurityReason).to.have.been.calledOnceWith(1);
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue.message).to.equal('Security reason deleted successfully');
    });
  });
});
