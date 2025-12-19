import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../database/db';
import { SearchFeatureResult } from '../../repositories/search-index-respository';
import { SearchIndexService } from '../../services/search-index-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../__mocks__/db';
import * as search from './index';

chai.use(sinonChai);

describe('searchFeatures', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('should return search results for keyword search', async () => {
    const mockResults: SearchFeatureResult[] = [
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
        relevancy_score: 0.75
      }
    ];

    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });

    sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.body = { keywords: 'moose habitat' };

    const mockSearchFeatures = sinon.stub(SearchIndexService.prototype, 'searchFeatures').resolves(mockResults);

    const requestHandler = search.searchFeatures();

    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockSearchFeatures).to.have.been.calledOnceWith({
      keywords: 'moose habitat',
      propertyFilters: undefined
    });
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(mockResults);
  });

  it('should return search results for property filters', async () => {
    const mockResults: SearchFeatureResult[] = [
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
        relevancy_score: 0.6
      }
    ];

    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });

    sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.body = {
      propertyFilters: [{ propertyName: 'focal_species', value: 'Moose' }]
    };

    const mockSearchFeatures = sinon.stub(SearchIndexService.prototype, 'searchFeatures').resolves(mockResults);

    const requestHandler = search.searchFeatures();

    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockSearchFeatures).to.have.been.calledOnceWith({
      keywords: undefined,
      propertyFilters: [{ propertyName: 'focal_species', value: 'Moose' }]
    });
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(mockResults);
  });

  it('should return search results for combined keyword and property filter search', async () => {
    const mockResults: SearchFeatureResult[] = [
      {
        submission_feature_id: 3,
        submission_id: 12,
        uuid: '550e8400-e29b-41d4-a716-446655440003',
        feature_type_id: 2,
        feature_type_name: 'observation',
        feature_name: 'Wildlife Observation',
        feature_description: null,
        submission_name: 'Northern BC Wildlife Survey',
        is_secured: false,
        relevancy_score: 1.2
      }
    ];

    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });

    sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.body = {
      keywords: 'wildlife',
      propertyFilters: [{ propertyName: 'region', value: 'Northern BC' }]
    };

    const mockSearchFeatures = sinon.stub(SearchIndexService.prototype, 'searchFeatures').resolves(mockResults);

    const requestHandler = search.searchFeatures();

    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockSearchFeatures).to.have.been.calledOnceWith({
      keywords: 'wildlife',
      propertyFilters: [{ propertyName: 'region', value: 'Northern BC' }]
    });
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(mockResults);
  });

  it('should return empty array when no search criteria provided', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });

    sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.body = {};

    const mockSearchFeatures = sinon.stub(SearchIndexService.prototype, 'searchFeatures').resolves([]);

    const requestHandler = search.searchFeatures();

    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockSearchFeatures).to.have.been.calledOnceWith({
      keywords: undefined,
      propertyFilters: undefined
    });
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql([]);
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
    sinon.stub(SearchIndexService.prototype, 'searchFeatures').rejects(testError);

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
});
