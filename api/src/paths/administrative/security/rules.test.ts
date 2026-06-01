import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import * as db from '../../../database/db';
import { ApiError } from '../../../errors/api-error';
import { SecurityRuleService } from '../../../services/security-rule-service';
import { getActiveSecurityRules } from './rules';

chai.use(sinonChai);

describe('administrative/security/rules', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('GET/getActiveSecurityRules', () => {
    it('throws error if DB connection fails to open', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });

      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
      sinon.stub(mockDBConnection, 'open').rejects(new Error('DB open failed'));

      const requestHandler = getActiveSecurityRules();
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

    it('returns active rules with policy_id', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });

      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);

      const mockRules = [
        {
          security_rule_id: 1,
          policy_id: 'f4b2f372-98b2-4faa-b98e-91ea2296e370',
          name: 'Caribou',
          description: 'Sensitive data',
          record_effective_date: '2026-01-01',
          record_end_date: null,
          security_category_id: 1,
          category_name: 'Government Interests',
          category_description: 'Category',
          category_record_effective_date: '2026-01-01',
          category_record_end_date: null
        }
      ];

      sinon.stub(SecurityRuleService.prototype, 'getActiveRulesAndCategories').resolves(mockRules as any);

      const requestHandler = getActiveSecurityRules();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockDBConnection.commit).to.have.been.calledOnce;
      expect(mockDBConnection.release).to.have.been.calledOnce;
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql(mockRules);
      expect(mockRes.jsonValue[0].policy_id).to.equal('f4b2f372-98b2-4faa-b98e-91ea2296e370');
    });

    it('rolls back and rethrows if service throws', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });

      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
      sinon.stub(SecurityRuleService.prototype, 'getActiveRulesAndCategories').rejects(new Error('Service error'));

      const requestHandler = getActiveSecurityRules();
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
