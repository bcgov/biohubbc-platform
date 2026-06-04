import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { ApiConflictError } from '../errors/api-error';
import { SecurityCategoryRepository } from '../repositories/security-category-repository';
import { SecurityCategoryService } from './security-category-service';

chai.use(sinonChai);

describe('SecurityCategoryService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('createSecurityCategory', () => {
    it('inserts and returns the new category', async () => {
      const mockCategory = { security_category_id: 1, name: 'Health', description: 'Health category' };

      const mockDBConnection = getMockDBConnection();
      const service = new SecurityCategoryService(mockDBConnection);

      const insertStub = sinon
        .stub(SecurityCategoryRepository.prototype, 'insertSecurityCategory')
        .resolves(mockCategory);

      const result = await service.createSecurityCategory({ name: 'Health', description: 'Health category' });

      expect(insertStub).to.have.been.calledOnceWith({ name: 'Health', description: 'Health category' });
      expect(result).to.eql(mockCategory);
    });
  });

  describe('updateSecurityCategory', () => {
    it('updates and returns the refreshed category', async () => {
      const updatedCategory = { security_category_id: 1, name: 'Updated', description: 'Updated desc' };

      const mockDBConnection = getMockDBConnection();
      const service = new SecurityCategoryService(mockDBConnection);

      const updateStub = sinon.stub(SecurityCategoryRepository.prototype, 'updateSecurityCategory').resolves();
      const getStub = sinon.stub(SecurityCategoryRepository.prototype, 'getSecurityCategory').resolves(updatedCategory);

      const result = await service.updateSecurityCategory(1, { name: 'Updated', description: 'Updated desc' });

      expect(updateStub).to.have.been.calledOnceWith(1, { name: 'Updated', description: 'Updated desc' });
      expect(getStub).to.have.been.calledOnceWith(1);
      expect(result).to.eql(updatedCategory);
    });
  });

  describe('deleteSecurityCategory', () => {
    it('deletes when no active rules exist', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new SecurityCategoryService(mockDBConnection);

      const countStub = sinon
        .stub(SecurityCategoryRepository.prototype, 'getActiveSecurityRuleCountByCategory')
        .resolves(0);
      const deleteStub = sinon.stub(SecurityCategoryRepository.prototype, 'deleteSecurityCategory').resolves();

      await service.deleteSecurityCategory(1);

      expect(countStub).to.have.been.calledOnceWith(1);
      expect(deleteStub).to.have.been.calledOnceWith(1);
    });

    it('throws ApiConflictError when active rules exist', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new SecurityCategoryService(mockDBConnection);

      sinon.stub(SecurityCategoryRepository.prototype, 'getActiveSecurityRuleCountByCategory').resolves(3);
      const deleteStub = sinon.stub(SecurityCategoryRepository.prototype, 'deleteSecurityCategory').resolves();

      try {
        await service.deleteSecurityCategory(1);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiConflictError);
        expect((error as ApiConflictError).message).to.equal(
          'Cannot delete a security category that has active reasons'
        );
        expect(deleteStub).to.not.have.been.called;
      }
    });
  });
});
