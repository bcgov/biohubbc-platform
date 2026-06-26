import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import * as db from '../../../database/db';
import { ApiError } from '../../../errors/api-error';
import { SearchService } from '../../../services/search-service';
import * as search from './index';

chai.use(sinonChai);

describe('searchSummary', () => {
  const mockSummary = {
    features: [{ feature_type_name: 'survey', total: 5 }],
    submissions: { total: 3 },
    taxonomy: { total: 2, scientific_name: 'Some species' }
  };

  afterEach(() => {
    sinon.restore();
  });

  it('should return summary data for a search term', async () => {
    const dbConnectionObj = getMockDBConnection({
      open: sinon.stub().resolves(),
      commit: sinon.stub().resolves(),
      rollback: sinon.stub().resolves(),
      release: sinon.stub().resolves()
    });
    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.query = { keyword: 'moose' };

    const mockGetSearchSummary = sinon.stub(SearchService.prototype, 'getSearchSummary').resolves(mockSummary);

    const requestHandler = search.searchSummary();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockGetSearchSummary).to.have.been.calledOnceWith({ keyword: 'moose' });
    expect(dbConnectionObj.open).to.have.been.calledOnce;
    expect(dbConnectionObj.commit).to.have.been.calledOnce;
    expect(mockRes.setHeader).to.have.been.calledWith('Cache-Control', 'public, max-age=90');
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(mockSummary);
  });

  it('should rollback and propagate error if getSearchSummary throws', async () => {
    const dbConnectionObj = getMockDBConnection({
      open: sinon.stub().resolves(),
      commit: sinon.stub().resolves(),
      rollback: sinon.stub().resolves(),
      release: sinon.stub().resolves()
    });
    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.query = { keyword: 'fail' };

    const testError = new Error('Service failure');
    sinon.stub(SearchService.prototype, 'getSearchSummary').rejects(testError);

    const requestHandler = search.searchSummary();

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
      open: sinon.stub().rejects(new Error('open failed')),
      commit: sinon.stub().resolves(),
      rollback: sinon.stub().resolves(),
      release: sinon.stub().resolves()
    });
    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.query = { keyword: 'anything' };

    const requestHandler = search.searchSummary();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail('Expected error to be thrown');
    } catch (error) {
      expect((error as ApiError).message).to.equal('open failed');
      expect(dbConnectionObj.release).to.have.been.calledOnce;
    }
  });
});
