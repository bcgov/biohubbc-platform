import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../database/db';
import { SecurityService } from '../../../services/security-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import * as apply from './apply';

chai.use(sinonChai);

describe('apply', () => {
  describe('applySecurityRulesToArtifacts', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should return the rows on success (empty)', async () => {
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      const dbConnectionObj = getMockDBConnection({
        systemUserId: () => 1000
      });

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const applySecurityRulesToArtifactsStub = sinon
        .stub(SecurityService.prototype, 'applySecurityRulesToArtifacts')
        .resolves([]);

      mockReq.body = {
        artifactIds: [1, 2, 3, 4],
        securityReasonIds: [1, 2, 3, 4]
      };

      const requestHandler = apply.applySecurityRulesToArtifacts();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(applySecurityRulesToArtifactsStub).to.have.been.calledOnce;
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql([]);
    });

    it('should return the rows on success (not empty)', async () => {
      const data = {
        artifact_persecution_id: 1
      };

      const dbConnectionObj = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.body = {
        artifactIds: [1, 2, 3, 4],
        securityReasonIds: [1, 2, 3, 4]
      };

      const applySecurityRulesToArtifactsStub = sinon
        .stub(SecurityService.prototype, 'applySecurityRulesToArtifacts')
        .resolves([data]);

      const requestHandler = apply.applySecurityRulesToArtifacts();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(applySecurityRulesToArtifactsStub).to.have.been.calledOnce;
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql([data]);
    });
  });
});
