import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../database/db';
import { PropertySearchService } from '../../../services/property-search-service';
import { GroupedPropertyResults } from '../../../services/property-search-service.interface';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import * as search from './index';

chai.use(sinonChai);

describe('searchProperties', () => {
  const mockStringResults = [{ feature_property_id: 1, property_name: 'Length', relevancy_score: 1 }];
  const mockNumberResults = [{ feature_property_id: 2, property_name: 'Depth', relevancy_score: 1 }];

  const mockResultsWithData: GroupedPropertyResults = {
    string: mockStringResults,
    number: mockNumberResults
  };

  const mockResultsEmpty: GroupedPropertyResults = {
    string: [],
    number: []
  };

  afterEach(() => {
    sinon.restore();
  });

  it('should return search results for property search', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub().resolves(),
      rollback: sinon.stub().resolves(),
      release: sinon.stub().resolves(),
      open: sinon.stub().resolves()
    });
    sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.body = {
      filters: { keyword: 'test' },
      pagination: {
        page: '1',
        limit: '10'
      }
    };

    sinon.stub(PropertySearchService.prototype, 'searchProperty').resolves(mockResultsWithData);
    sinon.stub(PropertySearchService.prototype, 'getSearchPropertyCount').resolves(2);

    const requestHandler = search.searchProperties();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql({
      properties: mockResultsWithData,
      pagination: {
        total: 2,
        per_page: 10,
        current_page: 1,
        last_page: 1,
        sort: undefined,
        order: undefined
      }
    });
  });

  it('should return empty results when no properties found', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub().resolves(),
      rollback: sinon.stub().resolves(),
      release: sinon.stub().resolves(),
      open: sinon.stub().resolves()
    });
    sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.body = {
      filters: { keyword: 'none' },
      pagination: {
        page: '1',
        limit: '10'
      }
    };

    sinon.stub(PropertySearchService.prototype, 'searchProperty').resolves(mockResultsEmpty);
    sinon.stub(PropertySearchService.prototype, 'getSearchPropertyCount').resolves(0);

    const requestHandler = search.searchProperties();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql({
      properties: mockResultsEmpty,
      pagination: {
        total: 0,
        per_page: 10,
        current_page: 1,
        last_page: 1,
        sort: undefined,
        order: undefined
      }
    });
  });

  it('should handle pagination with sort and order', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub().resolves(),
      rollback: sinon.stub().resolves(),
      release: sinon.stub().resolves(),
      open: sinon.stub().resolves()
    });
    sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.body = {
      filters: { keyword: 'test' },
      pagination: {
        page: '2',
        limit: '5',
        sort: 'property_name',
        order: 'desc'
      }
    };

    sinon.stub(PropertySearchService.prototype, 'searchProperty').resolves(mockResultsWithData);
    sinon.stub(PropertySearchService.prototype, 'getSearchPropertyCount').resolves(12);

    const requestHandler = search.searchProperties();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql({
      properties: mockResultsWithData,
      pagination: {
        total: 12,
        per_page: 5,
        current_page: 2,
        last_page: 3,
        sort: 'property_name',
        order: 'desc'
      }
    });
  });

  it('should handle errors and rollback', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub().resolves(),
      rollback: sinon.stub().resolves(),
      release: sinon.stub().resolves(),
      open: sinon.stub().resolves()
    });
    sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.body = {
      filters: { keyword: 'error' },
      pagination: {
        page: '1',
        limit: '10'
      }
    };

    const testError = new Error('Test error');
    sinon.stub(PropertySearchService.prototype, 'searchProperty').rejects(testError);

    const requestHandler = search.searchProperties();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail('Expected error to be thrown');
    } catch (error) {
      expect(error).to.equal(testError);
      expect(dbConnectionObj.rollback).to.have.been.calledOnce;
      expect(dbConnectionObj.release).to.have.been.calledOnce;
    }
  });

  it('should handle missing pagination gracefully', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub().resolves(),
      rollback: sinon.stub().resolves(),
      release: sinon.stub().resolves(),
      open: sinon.stub().resolves()
    });
    sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.body = {
      filters: { keyword: 'test' }
      // No pagination provided
    };

    sinon.stub(PropertySearchService.prototype, 'searchProperty').resolves(mockResultsWithData);
    sinon.stub(PropertySearchService.prototype, 'getSearchPropertyCount').resolves(2);

    const requestHandler = search.searchProperties();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql({
      properties: mockResultsWithData,
      pagination: {
        total: 2,
        per_page: 25,
        current_page: 1,
        last_page: 1,
        sort: undefined,
        order: undefined
      }
    });
  });
});
