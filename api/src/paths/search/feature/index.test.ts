import chai, { expect } from 'chai';
import dayjs from 'dayjs';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import * as db from '../../../database/db';
import { SearchFeatureService } from '../../../services/search-feature-service';
import { SearchFeatureResultWithRelevancy } from '../../../services/search-feature-service.interface';
import * as search from './index';

chai.use(sinonChai);

describe('searchFeatures', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('should return search results for keyword search with filters', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub().resolves(),
      rollback: sinon.stub().resolves(),
      release: sinon.stub().resolves(),
      open: sinon.stub().resolves()
    });
    sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    const mockResults: SearchFeatureResultWithRelevancy[] = [
      {
        submission_feature_id: 1,
        submission_id: 10,
        uuid: '550e8400-e29b-41d4-a716-446655440001',
        feature_type_id: 1,
        feature_type_name: 'dataset',
        feature_name: 'Moose Study 2024',
        feature_description: 'A study of moose habitat in Northern BC',
        submission_name: 'Wildlife Monitoring Project',
        is_secured: false,
        relevancy_score: 0.75,
        create_date: dayjs().toISOString()
      }
    ];

    mockReq.body = {
      filters: {
        keywords: 'moose habitat'
      },
      pagination: {
        page: '1',
        limit: '10'
      }
    };

    sinon.stub(SearchFeatureService.prototype, 'searchFeatures').resolves(mockResults);
    sinon.stub(SearchFeatureService.prototype, 'getSearchFeaturesCount').resolves(mockResults.length);

    const requestHandler = search.searchFeatures();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql({
      features: mockResults,
      pagination: {
        total: 1,
        per_page: 10,
        current_page: 1,
        last_page: 1,
        sort: undefined,
        order: undefined
      }
    });
  });

  it('should return search results for property filters', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub().resolves(),
      rollback: sinon.stub().resolves(),
      release: sinon.stub().resolves(),
      open: sinon.stub().resolves()
    });
    sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    const mockResults: SearchFeatureResultWithRelevancy[] = [
      {
        submission_feature_id: 2,
        submission_id: 11,
        uuid: '550e8400-e29b-41d4-a716-446655440002',
        feature_type_id: 1,
        feature_type_name: 'dataset',
        feature_name: 'Moose Population Survey',
        feature_description: 'Population survey data for moose',
        submission_name: 'Species Census 2024',
        is_secured: true,
        relevancy_score: 0.6,
        create_date: dayjs().toISOString()
      }
    ];

    mockReq.body = {
      filters: {
        propertyFilters: [{ propertyName: 'focal_species', value: 'Moose' }]
      },
      pagination: {
        page: '1',
        limit: '10'
      }
    };

    sinon.stub(SearchFeatureService.prototype, 'searchFeatures').resolves(mockResults);
    sinon.stub(SearchFeatureService.prototype, 'getSearchFeaturesCount').resolves(mockResults.length);

    const requestHandler = search.searchFeatures();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql({
      features: mockResults,
      pagination: {
        total: 1,
        per_page: 10,
        current_page: 1,
        last_page: 1,
        sort: undefined,
        order: undefined
      }
    });
  });

  it('should handle pagination with multiple pages', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub().resolves(),
      rollback: sinon.stub().resolves(),
      release: sinon.stub().resolves(),
      open: sinon.stub().resolves()
    });
    sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    const mockResults: SearchFeatureResultWithRelevancy[] = [
      {
        submission_feature_id: 3,
        submission_id: 12,
        uuid: '550e8400-e29b-41d4-a716-446655440003',
        feature_type_id: 1,
        feature_type_name: 'dataset',
        feature_name: 'Dataset 1',
        feature_description: 'Description 1',
        submission_name: 'Submission 1',
        is_secured: false,
        relevancy_score: 0.8,
        create_date: dayjs().toISOString()
      }
    ];

    mockReq.body = {
      filters: {
        keywords: 'test'
      },
      pagination: {
        page: '2',
        limit: '5',
        sort: 'feature_name',
        order: 'asc'
      }
    };

    sinon.stub(SearchFeatureService.prototype, 'searchFeatures').resolves(mockResults);
    sinon.stub(SearchFeatureService.prototype, 'getSearchFeaturesCount').resolves(25);

    const requestHandler = search.searchFeatures();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql({
      features: mockResults,
      pagination: {
        total: 25,
        per_page: 5,
        current_page: 2,
        last_page: 5,
        sort: 'feature_name',
        order: 'asc'
      }
    });
  });

  it('should return empty array when no results found', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub().resolves(),
      rollback: sinon.stub().resolves(),
      release: sinon.stub().resolves(),
      open: sinon.stub().resolves()
    });
    sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.body = {
      filters: {
        keywords: 'nonexistent'
      },
      pagination: {
        page: '1',
        limit: '10'
      }
    };

    sinon.stub(SearchFeatureService.prototype, 'searchFeatures').resolves([]);
    sinon.stub(SearchFeatureService.prototype, 'getSearchFeaturesCount').resolves(0);

    const requestHandler = search.searchFeatures();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql({
      features: [],
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
      filters: {
        keywords: 'test'
      },
      pagination: {
        page: '1',
        limit: '10'
      }
    };

    const testError = new Error('Test error');
    sinon.stub(SearchFeatureService.prototype, 'searchFeatures').rejects(testError);

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

  it('should handle missing pagination gracefully', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub().resolves(),
      rollback: sinon.stub().resolves(),
      release: sinon.stub().resolves(),
      open: sinon.stub().resolves()
    });
    sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    const mockResults: SearchFeatureResultWithRelevancy[] = [
      {
        submission_feature_id: 4,
        submission_id: 13,
        uuid: '550e8400-e29b-41d4-a716-446655440004',
        feature_type_id: 1,
        feature_type_name: 'dataset',
        feature_name: 'Dataset Without Pagination',
        feature_description: 'Description',
        submission_name: 'Submission',
        is_secured: false,
        relevancy_score: 0.9,
        create_date: dayjs().toISOString()
      }
    ];

    mockReq.body = {
      filters: {
        keywords: 'test'
      }
      // No pagination provided
    };

    sinon.stub(SearchFeatureService.prototype, 'searchFeatures').resolves(mockResults);
    sinon.stub(SearchFeatureService.prototype, 'getSearchFeaturesCount').resolves(mockResults.length);

    const requestHandler = search.searchFeatures();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql({
      features: mockResults,
      pagination: {
        total: 1,
        per_page: 25,
        current_page: 1,
        last_page: 1,
        sort: undefined,
        order: undefined
      }
    });
  });

  it('should pass null systemUserId for anonymous requests', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub().resolves(),
      rollback: sinon.stub().resolves(),
      release: sinon.stub().resolves(),
      open: sinon.stub().resolves()
    });
    sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.body = {
      filters: { keyword: 'moose' },
      pagination: { page: '1', limit: '10' }
    };

    const searchStub = sinon.stub(SearchFeatureService.prototype, 'searchFeatures').resolves([]);
    const countStub = sinon.stub(SearchFeatureService.prototype, 'getSearchFeaturesCount').resolves(0);

    const requestHandler = search.searchFeatures();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(searchStub.firstCall.args[2]).to.equal(null);
    expect(countStub.firstCall.args[1]).to.equal(null);
  });

  it('should pass systemUserId for authenticated requests', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub().resolves(),
      rollback: sinon.stub().resolves(),
      release: sinon.stub().resolves(),
      open: sinon.stub().resolves(),
      systemUserId: () => 123
    });
    sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.keycloak_token = 'some-valid-token';
    mockReq.body = {
      filters: { keyword: 'moose' },
      pagination: { page: '1', limit: '10' }
    };

    const searchStub = sinon.stub(SearchFeatureService.prototype, 'searchFeatures').resolves([]);
    const countStub = sinon.stub(SearchFeatureService.prototype, 'getSearchFeaturesCount').resolves(0);

    const requestHandler = search.searchFeatures();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(searchStub.firstCall.args[2]).to.equal(123);
    expect(countStub.firstCall.args[1]).to.equal(123);
  });
});
