import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../__mocks__/db';
import * as db from '../../database/db';
import { SearchService } from '../../services/search-service';
import { SearchResponseWithCounts } from '../../services/search-service.interface';
import * as search from './index';

chai.use(sinonChai);

describe('search', () => {
  const mockPaginationTotal = 1;
  const mockSubmissionRow = { name: 'name', submission_id: 1, description: null };
  const mockFeatureRows = [
    { feature_type_id: 1, feature_type_name: 'survey', label: 'label', submission_feature_id: 1 },
    { feature_type_id: 2, feature_type_name: 'observation', label: 'label2', submission_feature_id: 2 }
  ];

  const mockResultsWithData: SearchResponseWithCounts = {
    submissions: { data: [mockSubmissionRow], total: mockPaginationTotal },
    features: { data: mockFeatureRows, total: mockFeatureRows.length },
    taxonomy: { data: [], total: 0 }
  };

  const mockResultsEmpty: SearchResponseWithCounts = {
    submissions: { data: [], total: 0 },
    features: { data: [], total: 0 },
    taxonomy: { data: [], total: 0 }
  };

  const defaultPaginationNumbers = { page: 1, limit: 2, sort: undefined, order: undefined };

  afterEach(() => {
    sinon.restore();
  });

  it('should return search results for keyword search', async () => {
    const dbConnectionObj = getMockDBConnection({
      open: sinon.stub().resolves(),
      commit: sinon.stub().resolves(),
      rollback: sinon.stub().resolves(),
      release: sinon.stub().resolves()
    });
    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.query = { keyword: 'moose habitat', page: '1', limit: '2' };

    const mockSearch = sinon.stub(SearchService.prototype, 'search').resolves(mockResultsWithData);

    const requestHandler = search.searchAll();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockSearch).to.have.been.calledOnceWith(
      { keyword: 'moose habitat', feature_type_name: undefined },
      defaultPaginationNumbers
    );

    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(mockResultsWithData);
  });

  it('should return search results with feature_type_name filter', async () => {
    const dbConnectionObj = getMockDBConnection({
      open: sinon.stub().resolves(),
      commit: sinon.stub().resolves(),
      rollback: sinon.stub().resolves(),
      release: sinon.stub().resolves()
    });
    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.query = { keyword: 'moose', feature_type_name: 'survey', page: '1', limit: '2' };

    const mockSearch = sinon.stub(SearchService.prototype, 'search').resolves(mockResultsWithData);

    const requestHandler = search.searchAll();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockSearch).to.have.been.calledOnceWith(
      { keyword: 'moose', feature_type_name: 'survey' },
      defaultPaginationNumbers
    );

    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(mockResultsWithData);
  });

  it('should return search results with custom pagination', async () => {
    const customNumbers = { page: 2, limit: 5, sort: undefined, order: undefined };
    const dbConnectionObj = getMockDBConnection({
      open: sinon.stub().resolves(),
      commit: sinon.stub().resolves(),
      rollback: sinon.stub().resolves(),
      release: sinon.stub().resolves()
    });
    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.query = { keyword: 'wildlife', page: '2', limit: '5' };

    const mockSearch = sinon.stub(SearchService.prototype, 'search').resolves(mockResultsWithData);

    const requestHandler = search.searchAll();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockSearch).to.have.been.calledOnceWith(
      { keyword: 'wildlife', feature_type_name: undefined },
      customNumbers
    );

    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(mockResultsWithData);
  });

  it('should return empty results when no keyword provided', async () => {
    const dbConnectionObj = getMockDBConnection({
      open: sinon.stub().resolves(),
      commit: sinon.stub().resolves(),
      rollback: sinon.stub().resolves(),
      release: sinon.stub().resolves()
    });
    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.query = { page: '1', limit: '2' };

    const mockSearch = sinon.stub(SearchService.prototype, 'search').resolves(mockResultsEmpty);

    const requestHandler = search.searchAll();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockSearch).to.have.been.calledOnceWith(
      { keyword: '', feature_type_name: undefined },
      defaultPaginationNumbers
    );

    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(mockResultsEmpty);
  });

  it('should handle errors and rollback', async () => {
    const dbConnectionObj = getMockDBConnection({
      open: sinon.stub().resolves(),
      commit: sinon.stub().resolves(),
      rollback: sinon.stub().resolves(),
      release: sinon.stub().resolves()
    });
    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.query = { keyword: 'test', page: '1', limit: '2' };

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
