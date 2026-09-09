import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../__mocks__/db';
import * as db from '../../../../../database/db';
import { SearchFeatureService } from '../../../../../services/search-feature-service';
import * as count from './index';

chai.use(sinonChai);

describe('countFeatures', () => {
  const expressionTree = {
    type: 'expression',
    operator: 'AND',
    clauses: [
      {
        type: 'predicate',
        feature_property_id: 14,
        feature_type_property_id: null,
        operator: 'GreaterThan',
        value: 30
      }
    ]
  };

  afterEach(() => {
    sinon.restore();
  });

  it('should return the total for the requested expression', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub().resolves(),
      rollback: sinon.stub().resolves(),
      release: sinon.stub(),
      open: sinon.stub().resolves()
    });
    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { feature_type: '  SPECIES_OBSERVATION  ' };
    mockReq.body = { expression: expressionTree };

    const countStub = sinon
      .stub(SearchFeatureService.prototype, 'countSearchFeaturesByExpressionTree')
      .resolves(3_400_000);

    await count.countFeatures()(mockReq, mockRes, mockNext);

    expect(countStub.firstCall.args).to.deep.equal(['species_observation', expressionTree, null]);
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.deep.equal({ total: 3_400_000 });
    expect(dbConnectionObj.commit).to.have.been.calledOnce;
    expect(dbConnectionObj.release).to.have.been.calledOnce;
  });

  it('should count a broad feature type when the expression is omitted', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub().resolves(),
      rollback: sinon.stub().resolves(),
      release: sinon.stub(),
      open: sinon.stub().resolves()
    });
    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { feature_type: 'species_observation' };
    mockReq.body = {};

    const countStub = sinon
      .stub(SearchFeatureService.prototype, 'countSearchFeaturesByExpressionTree')
      .resolves(5_000_000);

    await count.countFeatures()(mockReq, mockRes, mockNext);

    expect(countStub.firstCall.args).to.deep.equal(['species_observation', undefined, null]);
    expect(mockRes.jsonValue).to.deep.equal({ total: 5_000_000 });
  });

  it('should reject invalid expression trees and roll back', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub().resolves(),
      rollback: sinon.stub().resolves(),
      release: sinon.stub(),
      open: sinon.stub().resolves()
    });
    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { feature_type: 'species_observation' };
    mockReq.body = { expression: { type: 'expression' } };

    try {
      await count.countFeatures()(mockReq, mockRes, mockNext);
      expect.fail('Expected countFeatures to reject');
    } catch (error) {
      expect((error as Error).message).to.equal('Invalid expression tree');
    }

    expect(dbConnectionObj.rollback).to.have.been.calledOnce;
    expect(dbConnectionObj.release).to.have.been.calledOnce;
  });

  it('should roll back and release the connection when counting fails', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub().resolves(),
      rollback: sinon.stub().resolves(),
      release: sinon.stub(),
      open: sinon.stub().resolves()
    });
    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { feature_type: 'species_observation' };
    mockReq.body = { expression: expressionTree };

    const testError = new Error('Count failed');
    sinon.stub(SearchFeatureService.prototype, 'countSearchFeaturesByExpressionTree').rejects(testError);

    try {
      await count.countFeatures()(mockReq, mockRes, mockNext);
      expect.fail('Expected countFeatures to reject');
    } catch (error) {
      expect(error).to.equal(testError);
    }

    expect(dbConnectionObj.rollback).to.have.been.calledOnce;
    expect(dbConnectionObj.release).to.have.been.calledOnce;
  });

  it('should cancel database work when the HTTP client disconnects', async () => {
    let rejectCount!: (error: Error) => void;
    const cancelStub = sinon.stub().callsFake(async () => rejectCount(new Error('Query cancelled')));
    const dbConnectionObj = getMockDBConnection({
      cancel: cancelStub,
      commit: sinon.stub().resolves(),
      rollback: sinon.stub().resolves(),
      release: sinon.stub(),
      open: sinon.stub().resolves()
    });
    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').callsFake((options) => {
      options?.signal?.addEventListener('abort', () => void dbConnectionObj.cancel(), { once: true });
      return dbConnectionObj;
    });

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { feature_type: 'species_observation' };
    mockReq.body = {};
    const countStub = sinon
      .stub(SearchFeatureService.prototype, 'countSearchFeaturesByExpressionTree')
      .returns(new Promise((_, reject) => (rejectCount = reject)));

    const handlerPromise = count.countFeatures()(mockReq, mockRes, mockNext);
    await Promise.resolve();
    mockRes.emit('close');
    try {
      await handlerPromise;
      expect.fail('Expected countFeatures to reject');
    } catch (error) {
      expect((error as Error).message).to.equal('Query cancelled');
    }

    expect(countStub).to.have.been.calledOnce;
    expect(cancelStub).to.have.been.calledOnce;
    expect(dbConnectionObj.rollback).to.have.been.calledOnce;
    expect(dbConnectionObj.release).to.have.been.calledOnce;
    expect(dbConnectionObj.commit).not.to.have.been.called;
    expect(mockRes.status).not.to.have.been.called;
  });
});
