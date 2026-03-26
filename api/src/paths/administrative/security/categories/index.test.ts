import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getSecurityCategories } from '.';
import * as db from '../../../../database/db';
import { ApiError } from '../../../../errors/api-error';
import { SecurityService } from '../../../../services/security-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';

import { makePaginationOptionsFromRequest } from '../../../../utils/pagination';

chai.use(sinonChai);

describe('administrative/security/categories', () => {
  afterEach(() => {
    sinon.restore();
  });

  const mockCategories = [
    {
      security_category_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
      name: 'Health',
      rule_count: 7
    }
  ];

  describe('GET/getSecurityCategories', () => {
    it('throws error if DB connection fails to open', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });

      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
      sinon.stub(mockDBConnection, 'open').rejects(new Error('DB open failed'));

      const requestHandler = getSecurityCategories();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail('Expected handler to throw');
      } catch (error) {
        expect((error as ApiError).message).to.equal('DB open failed');
        expect(mockDBConnection.rollback).to.have.been.calledOnce;
        expect(mockDBConnection.release).to.have.been.calledOnce;
      }
    });

    it('calls SecurityService methods with default pagination and returns 200', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });

      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

      const withRuleCountStub = sinon
        .stub(SecurityService.prototype, 'getSecurityCategoriesWithRuleCount')
        .resolves(mockCategories as any);

      const countStub = sinon.stub(SecurityService.prototype, 'getSecurityCategoriesCount').resolves(3 as any);

      const requestHandler = getSecurityCategories();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.query = {};

      const expectedPagination = makePaginationOptionsFromRequest(mockReq);

      await requestHandler(mockReq, mockRes, mockNext);

      expect(withRuleCountStub).to.have.been.calledOnceWith({ search: undefined }, expectedPagination);
      expect(countStub).to.have.been.calledOnceWith({ search: undefined });
      expect(mockDBConnection.commit).to.have.been.calledOnce;
      expect(mockDBConnection.release).to.have.been.calledOnce;

      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue.categories).to.eql(mockCategories);
      expect(mockRes.jsonValue.pagination.total).to.equal(3);
    });

    it('parses search query param and passes it to service', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });

      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

      const withRuleCountStub = sinon
        .stub(SecurityService.prototype, 'getSecurityCategoriesWithRuleCount')
        .resolves(mockCategories as any);
      sinon.stub(SecurityService.prototype, 'getSecurityCategoriesCount').resolves(1 as any);

      const requestHandler = getSecurityCategories();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.query = { search: 'health' };

      const expectedPagination = makePaginationOptionsFromRequest(mockReq);

      await requestHandler(mockReq, mockRes, mockNext);

      expect(withRuleCountStub).to.have.been.calledOnceWith({ search: 'health' }, expectedPagination);
      expect(mockRes.statusValue).to.equal(200);
    });

    it('rolls back and rethrows if service throws', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });

      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
      sinon.stub(SecurityService.prototype, 'getSecurityCategoriesWithRuleCount').rejects(new Error('Service error'));

      const requestHandler = getSecurityCategories();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail('Expected handler to throw');
      } catch (error) {
        expect((error as ApiError).message).to.equal('Service error');
        expect(mockDBConnection.rollback).to.have.been.calledOnce;
        expect(mockDBConnection.release).to.have.been.calledOnce;
      }
    });
  });
});
