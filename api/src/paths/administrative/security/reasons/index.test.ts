import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getSecurityReasons } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import * as db from '../../../../database/db';
import { ApiError } from '../../../../errors/api-error';
import { SecurityService } from '../../../../services/security-service';

import { makePaginationOptionsFromRequest } from '../../../../utils/pagination';

chai.use(sinonChai);

describe('administrative/security/reasons', () => {
  afterEach(() => {
    sinon.restore();
  });

  const mockReasons = [
    {
      security_reason_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
      reason: 'Research purposes',
      feature_count: 3
    }
  ];

  describe('GET/getSecurityReasons', () => {
    it('throws error if DB connection fails to open', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });

      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
      sinon.stub(mockDBConnection, 'open').rejects(new Error('DB open failed'));

      const requestHandler = getSecurityReasons();
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

      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);

      const withFeatureCountStub = sinon
        .stub(SecurityService.prototype, 'getSecurityRulesWithFeatureCount')
        .resolves(mockReasons as any);

      const countStub = sinon.stub(SecurityService.prototype, 'getSecurityRulesCount').resolves(1 as any);

      const requestHandler = getSecurityReasons();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.query = {};

      const expectedPagination = makePaginationOptionsFromRequest(mockReq);

      await requestHandler(mockReq, mockRes, mockNext);

      expect(withFeatureCountStub).to.have.been.calledOnceWith({ search: undefined }, expectedPagination);
      expect(countStub).to.have.been.calledOnceWith({ search: undefined });
      expect(mockDBConnection.commit).to.have.been.calledOnce;
      expect(mockDBConnection.release).to.have.been.calledOnce;

      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue.reasons).to.eql(mockReasons);
      expect(mockRes.jsonValue.pagination.total).to.equal(1);
    });

    it('parses search query param and passes it to service', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });

      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);

      const withFeatureCountStub = sinon
        .stub(SecurityService.prototype, 'getSecurityRulesWithFeatureCount')
        .resolves(mockReasons as any);
      sinon.stub(SecurityService.prototype, 'getSecurityRulesCount').resolves(2 as any);

      const requestHandler = getSecurityReasons();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.query = { search: 'diabetes' };

      const expectedPagination = makePaginationOptionsFromRequest(mockReq);

      await requestHandler(mockReq, mockRes, mockNext);

      expect(withFeatureCountStub).to.have.been.calledOnceWith({ search: 'diabetes' }, expectedPagination);
      expect(mockRes.statusValue).to.equal(200);
    });

    it('rolls back and rethrows if service throws', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });

      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
      sinon.stub(SecurityService.prototype, 'getSecurityRulesWithFeatureCount').rejects(new Error('Service error'));

      const requestHandler = getSecurityReasons();
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
