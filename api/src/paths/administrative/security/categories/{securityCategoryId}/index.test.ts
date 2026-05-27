import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../__mocks__/db';
import * as db from '../../../../../database/db';
import { SecurityCategory } from '../../../../../models/security-category';
import { SecurityService } from '../../../../../services/security-service';
import { deleteSecurityCategory, getSecurityCategory, updateSecurityCategory } from './index';

chai.use(sinonChai);

describe('administrative/security/categories/{securityCategoryId}', () => {
  afterEach(() => {
    sinon.restore();
  });

  const mockCategory: SecurityCategory = {
    security_category_id: 1,
    name: 'Health',
    description: 'Health category'
  };

  describe('GET/getSecurityCategory', () => {
    it('returns 200 with category details', async () => {
      const mockDBConnection = getMockDBConnection();
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
      sinon.stub(SecurityService.prototype, 'getSecurityCategory').resolves(mockCategory);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params = { securityCategoryId: '1' };

      await getSecurityCategory()(mockReq, mockRes, mockNext);

      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql(mockCategory);
    });
  });

  describe('PUT/updateSecurityCategory', () => {
    it('returns 200 with updated category', async () => {
      const updatedCategory = { ...mockCategory, name: 'Updated' };
      const mockDBConnection = getMockDBConnection();
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
      sinon.stub(SecurityService.prototype, 'updateSecurityCategory').resolves(updatedCategory);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params = { securityCategoryId: '1' };
      mockReq.body = { name: 'Updated', description: 'Health category' };

      await updateSecurityCategory()(mockReq, mockRes, mockNext);

      expect(SecurityService.prototype.updateSecurityCategory).to.have.been.calledOnceWith(1, {
        name: 'Updated',
        description: 'Health category'
      });
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql(updatedCategory);
    });
  });

  describe('DELETE/deleteSecurityCategory', () => {
    it('returns 200 when category is deleted', async () => {
      const mockDBConnection = getMockDBConnection();
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
      sinon.stub(SecurityService.prototype, 'deleteSecurityCategory').resolves();

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params = { securityCategoryId: '1' };

      await deleteSecurityCategory()(mockReq, mockRes, mockNext);

      expect(SecurityService.prototype.deleteSecurityCategory).to.have.been.calledOnceWith(1);
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue.message).to.equal('Security category deleted successfully');
    });
  });
});
