import chai, { expect } from 'chai';
import dayjs from 'dayjs';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import * as db from '../../../../database/db';
import { SearchFeatureService } from '../../../../services/search-feature-service';
import { SearchFeatureResultWithRelevancy } from '../../../../services/search-feature-service.interface';
import { UserService } from '../../../../services/user-service';
import * as search from './index';

chai.use(sinonChai);

describe('searchFeatures', () => {
  const expressionTree = {
    type: 'expression',
    operator: 'AND',
    clauses: [
      {
        type: 'predicate',
        feature_property_id: 1,
        feature_type_property_id: null,
        operator: 'Contains',
        value: 'moose'
      }
    ]
  };

  afterEach(() => {
    sinon.restore();
  });

  it('should search the requested feature type with an expression tree', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub().resolves(),
      rollback: sinon.stub().resolves(),
      release: sinon.stub().resolves(),
      open: sinon.stub().resolves()
    });
    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { feature_type: '  SURVEY  ' };

    const mockResults: SearchFeatureResultWithRelevancy[] = [
      {
        submission_feature_id: 1,
        submission_id: 10,
        uuid: '550e8400-e29b-41d4-a716-446655440001',
        feature_type_id: 1,
        feature_type_name: 'survey',
        properties: {},
        submission_name: 'Wildlife Monitoring Project',
        is_secured: false,
        relevancy_score: 0.75,
        create_date: dayjs().toISOString()
      }
    ];

    mockReq.body = {
      expression: expressionTree,
      pagination: {
        limit: '10'
      }
    };

    const searchStub = sinon
      .stub(SearchFeatureService.prototype, 'searchFeaturesByExpressionTreeWithMetadata')
      .resolves({
        features: mockResults,
        properties: [],
        has_more_secured_features: false,
        pagination: { next_cursor: null, previous_cursor: null }
      });

    const requestHandler = search.searchFeatures();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockRes.statusValue).to.equal(200);
    expect(searchStub.firstCall.args[0]).to.equal('survey');
    expect(searchStub.firstCall.args[1]).to.eql(expressionTree);
    expect(searchStub.firstCall.args[2]).to.eql({
      limit: 10,
      boundary: undefined,
      sort: 'relevancy_score',
      order: 'desc'
    });
    expect(mockRes.jsonValue).to.eql({
      features: mockResults,
      properties: [],
      has_more_secured_features: false,
      pagination: { next_cursor: null, previous_cursor: null }
    });
  });

  it('should return expression search results for secured features visible to the caller', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub().resolves(),
      rollback: sinon.stub().resolves(),
      release: sinon.stub().resolves(),
      open: sinon.stub().resolves()
    });
    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { feature_type: 'survey' };

    const mockResults: SearchFeatureResultWithRelevancy[] = [
      {
        submission_feature_id: 2,
        submission_id: 11,
        uuid: '550e8400-e29b-41d4-a716-446655440002',
        feature_type_id: 1,
        feature_type_name: 'survey',
        properties: {},
        submission_name: 'Species Census 2024',
        is_secured: true,
        relevancy_score: 0.6,
        create_date: dayjs().toISOString()
      }
    ];

    mockReq.body = {
      expression: expressionTree,
      pagination: {
        limit: '10'
      }
    };

    sinon.stub(SearchFeatureService.prototype, 'searchFeaturesByExpressionTreeWithMetadata').resolves({
      features: mockResults,
      properties: [],
      has_more_secured_features: false,
      pagination: { next_cursor: null, previous_cursor: null }
    });

    const requestHandler = search.searchFeatures();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockRes.statusValue).to.equal(200);
    // A visible secured row the caller CAN see must not, by itself, set has_more_secured_features.
    expect(mockRes.jsonValue).to.eql({
      features: mockResults,
      properties: [],
      has_more_secured_features: false,
      pagination: { next_cursor: null, previous_cursor: null }
    });
  });

  it('should expose has_more_secured_features when secured matches are hidden from the caller', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub().resolves(),
      rollback: sinon.stub().resolves(),
      release: sinon.stub().resolves(),
      open: sinon.stub().resolves()
    });
    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { feature_type: 'dataset' };
    mockReq.body = {
      expression: expressionTree,
      pagination: { limit: '10' }
    };

    sinon.stub(SearchFeatureService.prototype, 'searchFeaturesByExpressionTreeWithMetadata').resolves({
      features: [],
      properties: [],
      has_more_secured_features: true,
      pagination: { next_cursor: null, previous_cursor: null }
    });

    const requestHandler = search.searchFeatures();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue.has_more_secured_features).to.equal(true);
    // No hidden secured rows are leaked alongside the flag.
    expect(mockRes.jsonValue.features).to.eql([]);
  });

  it('should handle pagination with multiple pages', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub().resolves(),
      rollback: sinon.stub().resolves(),
      release: sinon.stub().resolves(),
      open: sinon.stub().resolves()
    });
    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { feature_type: 'survey' };

    const mockResults: SearchFeatureResultWithRelevancy[] = [
      {
        submission_feature_id: 3,
        submission_id: 12,
        uuid: '550e8400-e29b-41d4-a716-446655440003',
        feature_type_id: 1,
        feature_type_name: 'survey',
        properties: {},
        submission_name: 'Submission 1',
        is_secured: false,
        relevancy_score: 0.8,
        create_date: dayjs().toISOString()
      }
    ];

    mockReq.body = {
      expression: expressionTree,
      pagination: {
        limit: '5',
        sort: 'feature_type_name',
        order: 'asc'
      }
    };

    sinon.stub(SearchFeatureService.prototype, 'searchFeaturesByExpressionTreeWithMetadata').resolves({
      features: mockResults,
      properties: [],
      has_more_secured_features: false,
      pagination: { next_cursor: null, previous_cursor: null }
    });

    const requestHandler = search.searchFeatures();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql({
      features: mockResults,
      properties: [],
      has_more_secured_features: false,
      pagination: { next_cursor: null, previous_cursor: null }
    });
  });

  it('should return empty array when no results found', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub().resolves(),
      rollback: sinon.stub().resolves(),
      release: sinon.stub().resolves(),
      open: sinon.stub().resolves()
    });
    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { feature_type: 'survey' };

    mockReq.body = {
      expression: expressionTree,
      pagination: {
        limit: '10'
      }
    };

    sinon.stub(SearchFeatureService.prototype, 'searchFeaturesByExpressionTreeWithMetadata').resolves({
      features: [],
      properties: [],
      has_more_secured_features: false,
      pagination: { next_cursor: null, previous_cursor: null }
    });

    const requestHandler = search.searchFeatures();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql({
      features: [],
      properties: [],
      has_more_secured_features: false,
      pagination: { next_cursor: null, previous_cursor: null }
    });
  });

  it('should handle errors and rollback', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub().resolves(),
      rollback: sinon.stub().resolves(),
      release: sinon.stub().resolves(),
      open: sinon.stub().resolves()
    });
    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { feature_type: 'survey' };

    mockReq.body = {
      expression: expressionTree,
      pagination: {
        limit: '10'
      }
    };

    const testError = new Error('Test error');
    sinon.stub(SearchFeatureService.prototype, 'searchFeaturesByExpressionTreeWithMetadata').rejects(testError);

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

  it('should reject invalid expression request bodies', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub().resolves(),
      rollback: sinon.stub().resolves(),
      release: sinon.stub().resolves(),
      open: sinon.stub().resolves()
    });
    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { feature_type: 'survey' };
    mockReq.body = {
      expression: {
        type: 'expression'
      }
    };

    const requestHandler = search.searchFeatures();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail('Expected error to be thrown');
    } catch (error) {
      expect((error as Error).message).to.equal('Invalid expression tree');
      expect(dbConnectionObj.rollback).to.have.been.calledOnce;
      expect(dbConnectionObj.release).to.have.been.calledOnce;
    }
  });

  it('should return the first page of target features when no expression is provided', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub().resolves(),
      rollback: sinon.stub().resolves(),
      release: sinon.stub().resolves(),
      open: sinon.stub().resolves()
    });
    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { feature_type: 'telemetry' };
    mockReq.body = {
      pagination: { limit: '25' }
    };

    const mockResults: SearchFeatureResultWithRelevancy[] = [
      {
        submission_feature_id: 5,
        submission_id: 14,
        uuid: '550e8400-e29b-41d4-a716-446655440005',
        feature_type_id: 3,
        feature_type_name: 'telemetry',
        properties: {},
        submission_name: 'Telemetry Submission',
        is_secured: false,
        relevancy_score: 1,
        create_date: dayjs().toISOString()
      }
    ];

    const searchStub = sinon
      .stub(SearchFeatureService.prototype, 'searchFeaturesByExpressionTreeWithMetadata')
      .resolves({
        features: mockResults,
        properties: [],
        has_more_secured_features: false,
        pagination: { next_cursor: null, previous_cursor: null }
      });

    const requestHandler = search.searchFeatures();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(searchStub.firstCall.args[0]).to.equal('telemetry');
    expect(searchStub.firstCall.args[1]).to.equal(undefined);
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue.pagination).to.eql({ next_cursor: null, previous_cursor: null });
  });

  it('should handle missing pagination gracefully', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub().resolves(),
      rollback: sinon.stub().resolves(),
      release: sinon.stub().resolves(),
      open: sinon.stub().resolves()
    });
    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { feature_type: 'survey' };

    const mockResults: SearchFeatureResultWithRelevancy[] = [
      {
        submission_feature_id: 4,
        submission_id: 13,
        uuid: '550e8400-e29b-41d4-a716-446655440004',
        feature_type_id: 1,
        feature_type_name: 'survey',
        properties: {},
        submission_name: 'Submission',
        is_secured: false,
        relevancy_score: 0.9,
        create_date: dayjs().toISOString()
      }
    ];

    mockReq.body = {
      expression: expressionTree
    };

    sinon.stub(SearchFeatureService.prototype, 'searchFeaturesByExpressionTreeWithMetadata').resolves({
      features: mockResults,
      properties: [],
      has_more_secured_features: false,
      pagination: { next_cursor: null, previous_cursor: null }
    });

    const requestHandler = search.searchFeatures();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql({
      features: mockResults,
      properties: [],
      has_more_secured_features: false,
      pagination: { next_cursor: null, previous_cursor: null }
    });
  });

  it('should pass null systemUserId for anonymous requests', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub().resolves(),
      rollback: sinon.stub().resolves(),
      release: sinon.stub().resolves(),
      open: sinon.stub().resolves()
    });
    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { feature_type: 'survey' };

    mockReq.body = {
      expression: expressionTree,
      pagination: { limit: '10' }
    };

    const searchStub = sinon
      .stub(SearchFeatureService.prototype, 'searchFeaturesByExpressionTreeWithMetadata')
      .resolves({
        features: [],
        properties: [],
        has_more_secured_features: false,
        pagination: { next_cursor: null, previous_cursor: null }
      });

    const requestHandler = search.searchFeatures();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(searchStub.firstCall.args[0]).to.equal('survey');
    expect(searchStub.firstCall.args[3]).to.equal(null);
  });

  it('should pass systemUserId for authenticated requests', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub().resolves(),
      rollback: sinon.stub().resolves(),
      release: sinon.stub().resolves(),
      open: sinon.stub().resolves(),
      systemUserId: () => 123
    });
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);
    sinon.stub(UserService.prototype, 'getUserById').resolves({} as any);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.keycloak_token = 'some-valid-token';
    mockReq.params = { feature_type: 'survey' };
    mockReq.body = {
      expression: expressionTree,
      pagination: { limit: '10' }
    };

    const searchStub = sinon
      .stub(SearchFeatureService.prototype, 'searchFeaturesByExpressionTreeWithMetadata')
      .resolves({
        features: [],
        properties: [],
        has_more_secured_features: false,
        pagination: { next_cursor: null, previous_cursor: null }
      });

    const requestHandler = search.searchFeatures();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(searchStub.firstCall.args[0]).to.equal('survey');
    expect(searchStub.firstCall.args[3]).to.equal(123);
  });

  it('should pass null systemUserId for inactive authenticated requests', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub().resolves(),
      rollback: sinon.stub().resolves(),
      release: sinon.stub().resolves(),
      open: sinon.stub().resolves(),
      systemUserId: () => 123
    });
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);
    sinon.stub(UserService.prototype, 'getUserById').rejects(new Error('inactive'));

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.keycloak_token = 'some-valid-token';
    mockReq.params = { feature_type: 'survey' };
    mockReq.body = {
      expression: expressionTree,
      pagination: { limit: '10' }
    };

    const searchStub = sinon
      .stub(SearchFeatureService.prototype, 'searchFeaturesByExpressionTreeWithMetadata')
      .resolves({
        features: [],
        properties: [],
        has_more_secured_features: false,
        pagination: { next_cursor: null, previous_cursor: null }
      });

    const requestHandler = search.searchFeatures();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(searchStub.firstCall.args[0]).to.equal('survey');
    expect(searchStub.firstCall.args[3]).to.equal(null);
  });

  it('should cancel database work when the HTTP client disconnects', async () => {
    let rejectSearch!: (error: Error) => void;
    const cancelStub = sinon.stub().callsFake(async () => rejectSearch(new Error('Query cancelled')));
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
    mockReq.params = { feature_type: 'survey' };
    mockReq.body = {};
    const searchStub = sinon
      .stub(SearchFeatureService.prototype, 'searchFeaturesByExpressionTreeWithMetadata')
      .returns(new Promise((_, reject) => (rejectSearch = reject)));

    const handlerPromise = search.searchFeatures()(mockReq, mockRes, mockNext);
    await Promise.resolve();
    mockRes.emit('close');
    try {
      await handlerPromise;
      expect.fail('Expected searchFeatures to reject');
    } catch (error) {
      expect((error as Error).message).to.equal('Query cancelled');
    }

    expect(searchStub).to.have.been.calledOnce;
    expect(cancelStub).to.have.been.calledOnce;
    expect(dbConnectionObj.rollback).to.have.been.calledOnce;
    expect(dbConnectionObj.release).to.have.been.calledOnce;
    expect(dbConnectionObj.commit).not.to.have.been.called;
    expect(mockRes.status).not.to.have.been.called;
  });
});
