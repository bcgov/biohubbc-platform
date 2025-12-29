import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../database/db';
import { ApiError } from '../../errors/api-error';
import { SearchService } from '../../services/search-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../__mocks__/db';
import * as search from './index';

chai.use(sinonChai);

describe('searchFeatures', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('should return paginated search results for a keyword', async () => {
    const mockResults = {
      features: { data: [{ submission_feature_id: 1, feature_type_id: 4, label: 'Feature 1' }], total: 1 },
      submissions: { data: [{ submission_id: 10, name: 'Submission 1', description: null }], total: 1 },
      taxonomy: { data: [{ taxon_id: 100, itis_scientific_name: 'Taxon A' }], total: 1 }
    };

    const dbConnectionObj = getMockDBConnection({
      open: sinon.stub(),
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });

    sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.query = { search: 'keyword', page: '1', limit: '10' };

    const searchStub = sinon.stub(SearchService.prototype, 'search').resolves(mockResults);

    const requestHandler = search.searchFeatures();

    await requestHandler(mockReq, mockRes, mockNext);

    expect(searchStub).to.have.been.calledOnceWith({ search: 'keyword' }, { page: 1, limit: 10 });
    expect(dbConnectionObj.open).to.have.been.calledOnce;
    expect(dbConnectionObj.commit).to.have.been.calledOnce;
    expect(mockRes.setHeader).to.have.been.calledWith('Cache-Control', 'public, max-age=90');
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(mockResults);
  });

  it('should handle missing pagination params', async () => {
    const mockResults = {
      features: { data: [], total: 0 },
      submissions: { data: [], total: 0 },
      taxonomy: { data: [], total: 0 }
    };

    const dbConnectionObj = getMockDBConnection({
      open: sinon.stub(),
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });

    sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.query = { search: 'keyword' };

    const searchStub = sinon.stub(SearchService.prototype, 'search').resolves(mockResults);

    const requestHandler = search.searchFeatures();

    await requestHandler(mockReq, mockRes, mockNext);

    expect(searchStub).to.have.been.calledOnceWith({ search: 'keyword' }, undefined);
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(mockResults);
  });

  it('should rollback and propagate error if search fails', async () => {
    const dbConnectionObj = getMockDBConnection({
      open: sinon.stub(),
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });

    sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.query = { search: 'fail' };

    const testError = new Error('Test search error');
    sinon.stub(SearchService.prototype, 'search').rejects(testError);

    const requestHandler = search.searchFeatures();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail('Expected error to be thrown');
    } catch (error) {
      expect(error).to.equal(testError);
      expect(dbConnectionObj.rollback).to.have.been.calledOnce;
      expect(dbConnectionObj.release).to.have.been.calledOnce;
    }
  });

  it('should always release the connection even if open fails', async () => {
    const dbConnectionObj = getMockDBConnection({
      open: sinon.stub().throws(new Error('open failed')),
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });

    sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.query = { search: 'anything' };

    const requestHandler = search.searchFeatures();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail('Expected error to be thrown');
    } catch (error) {
      expect((error as ApiError).message).to.equal('open failed');
      expect(dbConnectionObj.release).to.have.been.calledOnce;
    }
  });
});
