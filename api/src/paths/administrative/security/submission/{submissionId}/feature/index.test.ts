import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { patchSecurityRulesOnSubmissionFeatures } from '.';
import * as db from '../../../../../../database/db';
import { HTTPError } from '../../../../../../errors/http-error';
import { SecurityService } from '../../../../../../services/security-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../../__mocks__/db';

describe('patchSecurityRulesOnSubmissionFeatures', () => {
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

    const requestHandler = patchSecurityRulesOnSubmissionFeatures();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as HTTPError).message).to.equal('test error');
    }
  });

  it('should call service.patchSecurityRulesOnSubmissionFeatures with valid data and return 204', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });

    sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

    const patchSecurityStub = sinon
      .stub(SecurityService.prototype, 'patchSecurityRulesOnSubmissionFeatures')
      .resolves();

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.body = {
      submissionFeatureIds: [1, 2, 3],
      applyRuleIds: [4, 5],
      removeRuleIds: [6, 7]
    };

    const requestHandler = patchSecurityRulesOnSubmissionFeatures();

    await requestHandler(mockReq, mockRes, mockNext);

    expect(patchSecurityStub).to.have.been.calledOnceWith([1, 2, 3], [4, 5], [6, 7]);
    expect(mockRes.statusValue).to.equal(204);
  });

  it('should call service.patchSecurityRulesOnSubmissionFeatures with empty remove rule IDs', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });

    sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

    const patchSecurityStub = sinon
      .stub(SecurityService.prototype, 'patchSecurityRulesOnSubmissionFeatures')
      .resolves();

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.body = {
      submissionFeatureIds: [1, 2, 3],
      applyRuleIds: [4, 5],
      removeRuleIds: []
    };

    const requestHandler = patchSecurityRulesOnSubmissionFeatures();

    await requestHandler(mockReq, mockRes, mockNext);

    expect(patchSecurityStub).to.have.been.calledOnceWith([1, 2, 3], [4, 5], []);
    expect(mockRes.statusValue).to.equal(204);
  });

  it('should call service.patchSecurityRulesOnSubmissionFeatures with empty apply rule IDs', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });

    sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

    const patchSecurityStub = sinon
      .stub(SecurityService.prototype, 'patchSecurityRulesOnSubmissionFeatures')
      .resolves();

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.body = {
      submissionFeatureIds: [1, 2, 3],
      applyRuleIds: [],
      removeRuleIds: [6, 7]
    };

    const requestHandler = patchSecurityRulesOnSubmissionFeatures();

    await requestHandler(mockReq, mockRes, mockNext);

    expect(patchSecurityStub).to.have.been.calledOnceWith([1, 2, 3], [], [6, 7]);
    expect(mockRes.statusValue).to.equal(204);
  });

  it('should call service.patchSecurityRulesOnSubmissionFeatures with empty submission feature IDs', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });

    sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

    const patchSecurityStub = sinon
      .stub(SecurityService.prototype, 'patchSecurityRulesOnSubmissionFeatures')
      .resolves();

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.body = {
      submissionFeatureIds: [],
      applyRuleIds: [4, 5],
      removeRuleIds: [6, 7]
    };

    const requestHandler = patchSecurityRulesOnSubmissionFeatures();

    await requestHandler(mockReq, mockRes, mockNext);

    expect(patchSecurityStub).to.have.been.calledOnceWith([], [4, 5], [6, 7]);
    expect(mockRes.statusValue).to.equal(204);
  });
});
