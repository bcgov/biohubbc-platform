import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../database/db';
import { SearchService } from '../../services/search-service';
import { SearchResponseWithPagination } from '../../services/search-service.interface';
import { getMockDBConnection, getRequestHandlerMocks } from '../../__mocks__/db';
import * as search from './index';

chai.use(sinonChai);

describe('search', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('should return search results for keyword search', async () => {
    const mockResults: SearchResponseWithPagination = {
      submissions: { data: [{ name: 'name', submission_id: 1, description: null }], total: 1 },
      features: {
        data: [
          { feature_type_id: 1, label: 'label', submission_feature_id: 1 },
          { feature_type_id: 2, label: 'label2', submission_feature_id: 2 }
        ],
        total: 2
      },
      taxonomy: { data: [], total: 0 }
    };

    const dbConnectionObj = getMockDBConnection({
      open: sinon.stub().resolves(),
      commit: sinon.stub().resolves(),
      rollback: sinon.stub().resolves(),
      release: sinon.stub()
    });

    sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes } = getRequestHandlerMocks();

    mockReq.query = { search: 'moose habitat' };

    const mockSearch = sinon.stub(SearchService.prototype, 'search').resolves(mockResults);

    const requestHandler = search.searchAll();
    await requestHandler(mockReq, mockRes, {} as any);

    expect(mockSearch).to.have.been.calledOnceWith({ search: 'moose habitat' }, undefined);
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(mockResults);
  });

  it('should return search results with pagination', async () => {
    const mockResults: SearchResponseWithPagination = {
      submissions: { data: [{ name: 'name', submission_id: 1, description: null }], total: 1 },
      features: {
        data: [
          { feature_type_id: 1, label: 'label', submission_feature_id: 1 },
          { feature_type_id: 2, label: 'label2', submission_feature_id: 2 }
        ],
        total: 2
      },
      taxonomy: { data: [], total: 0 }
    };

    const dbConnectionObj = getMockDBConnection({
      open: sinon.stub().resolves(),
      commit: sinon.stub().resolves(),
      rollback: sinon.stub().resolves(),
      release: sinon.stub()
    });

    sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes } = getRequestHandlerMocks();

    mockReq.query = { search: 'wildlife', page: '2', limit: '10' };

    const mockSearch = sinon.stub(SearchService.prototype, 'search').resolves(mockResults);

    const requestHandler = search.searchAll();
    await requestHandler(mockReq, mockRes, {} as any);

    expect(mockSearch).to.have.been.calledOnceWith({ search: 'wildlife' }, { page: 2, limit: 10 });
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(mockResults);
  });

  it('should return empty results when no search criteria provided', async () => {
    const mockResults: SearchResponseWithPagination = {
      submissions: { data: [], total: 0 },
      features: { data: [], total: 0 },
      taxonomy: { data: [], total: 0 }
    };

    const dbConnectionObj = getMockDBConnection({
      open: sinon.stub().resolves(),
      commit: sinon.stub().resolves(),
      rollback: sinon.stub().resolves(),
      release: sinon.stub()
    });

    sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes } = getRequestHandlerMocks();

    mockReq.query = {};

    const mockSearch = sinon.stub(SearchService.prototype, 'search').resolves(mockResults);

    const requestHandler = search.searchAll();
    await requestHandler(mockReq, mockRes, {} as any);

    expect(mockSearch).to.have.been.calledOnceWith({ search: undefined }, undefined);
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(mockResults);
  });

  it('should handle errors and rollback', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });

    sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.body = { keywords: 'test' };

    const testError = new Error('Test error');
    sinon.stub(SearchService.prototype, 'search').rejects(testError);

    const requestHandler = search.searchAll();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail('Expected error to be thrown');
    } catch (error) {
      expect(error).to.equal(testError);
      expect(dbConnectionObj.rollback).to.have.been.calledOnce;
      expect(dbConnectionObj.release).to.have.been.calledOnce;
    }
  });
});
