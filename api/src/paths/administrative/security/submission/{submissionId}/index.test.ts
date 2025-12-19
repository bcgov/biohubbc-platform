import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { patchSecurityRulesOnSubmission } from '.';
import * as db from '../../../../../database/db';
import { HTTPError } from '../../../../../errors/http-error';
import { SecurityService } from '../../../../../services/security-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../__mocks__/db';

describe('patchSecurityRulesOnSubmission', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('should re-throw any error that is thrown', async () => {
    const mockDBConnection = getMockDBConnection({
      open: () => {
        throw new Error('test error');
      }
    });

    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.params = {
      submissionId: '1'
    };

    const requestHandler = patchSecurityRulesOnSubmission();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as HTTPError).message).to.equal('test error');
    }
  });

  it('should call service.patchSecurityRulesOnSubmission with valid data and return 204', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });

    sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

    const patchSecurityStub = sinon.stub(SecurityService.prototype, 'patchSecurityRulesOnSubmission').resolves();

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.params = {
      submissionId: '1'
    };
    mockReq.body = {
      applyRuleIds: [4, 5],
      removeRuleIds: [6, 7]
    };

    const requestHandler = patchSecurityRulesOnSubmission();

    await requestHandler(mockReq, mockRes, mockNext);

    expect(patchSecurityStub).to.have.been.calledOnceWith(1, [4, 5], [6, 7]);
    expect(mockRes.statusValue).to.equal(204);
  });

  it('should call service.patchSecurityRulesOnSubmission with empty remove rule IDs', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });

    sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

    const patchSecurityStub = sinon.stub(SecurityService.prototype, 'patchSecurityRulesOnSubmission').resolves();

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.params = {
      submissionId: '2'
    };
    mockReq.body = {
      applyRuleIds: [4, 5],
      removeRuleIds: []
    };

    const requestHandler = patchSecurityRulesOnSubmission();

    await requestHandler(mockReq, mockRes, mockNext);

    expect(patchSecurityStub).to.have.been.calledOnceWith(2, [4, 5], []);
    expect(mockRes.statusValue).to.equal(204);
  });

  it('should call service.patchSecurityRulesOnSubmission with empty apply rule IDs', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });

    sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

    const patchSecurityStub = sinon.stub(SecurityService.prototype, 'patchSecurityRulesOnSubmission').resolves();

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.params = {
      submissionId: '3'
    };
    mockReq.body = {
      applyRuleIds: [],
      removeRuleIds: [6, 7]
    };

    const requestHandler = patchSecurityRulesOnSubmission();

    await requestHandler(mockReq, mockRes, mockNext);

    expect(patchSecurityStub).to.have.been.calledOnceWith(3, [], [6, 7]);
    expect(mockRes.statusValue).to.equal(204);
  });

  it('should call service.patchSecurityRulesOnSubmission with both empty arrays', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });

    sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

    const patchSecurityStub = sinon.stub(SecurityService.prototype, 'patchSecurityRulesOnSubmission').resolves();

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.params = {
      submissionId: '4'
    };
    mockReq.body = {
      applyRuleIds: [],
      removeRuleIds: []
    };

    const requestHandler = patchSecurityRulesOnSubmission();

    await requestHandler(mockReq, mockRes, mockNext);

    expect(patchSecurityStub).to.have.been.calledOnceWith(4, []);
    expect(mockRes.statusValue).to.equal(204);
  });
});
