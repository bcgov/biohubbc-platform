import chai, { expect } from 'chai';
import dayjs from 'dayjs';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import * as db from '../../../../database/db';
import { SearchFeatureService } from '../../../../services/search-feature-service';
import { SearchFeatureResultWithRelevancy } from '../../../../services/search-feature-service.interface';
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
    mockReq.params = { feature_type: 'survey' };

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
        page: '1',
        limit: '10'
      }
    };

    const searchStub = sinon
      .stub(SearchFeatureService.prototype, 'searchFeaturesByExpressionTreeWithCount')
      .resolves({ features: mockResults, properties: [], count: mockResults.length, has_more_secured_features: false });

    const requestHandler = search.searchFeatures();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockRes.statusValue).to.equal(200);
    expect(searchStub.firstCall.args[0]).to.equal('survey');
    expect(searchStub.firstCall.args[1]).to.eql(expressionTree);
    expect(mockRes.jsonValue).to.eql({
      features: mockResults,
      properties: [],
      pagination: {
        total: 1,
        per_page: 10,
        current_page: 1,
        last_page: 1,
        sort: undefined,
        order: undefined
      },
      has_more_secured_features: false
    });
  });

  it('should normalize the requested feature type before searching', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub().resolves(),
      rollback: sinon.stub().resolves(),
      release: sinon.stub().resolves(),
      open: sinon.stub().resolves()
    });
    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { feature_type: '  SURVEY  ' };
    mockReq.body = {
      expression: expressionTree,
      pagination: {
        page: '1',
        limit: '10'
      }
    };

    const searchStub = sinon
      .stub(SearchFeatureService.prototype, 'searchFeaturesByExpressionTreeWithCount')
      .resolves({ features: [], properties: [], count: 0, has_more_secured_features: false });

    const requestHandler = search.searchFeatures();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(searchStub.firstCall.args[0]).to.equal('survey');
    expect(mockRes.statusValue).to.equal(200);
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
        page: '1',
        limit: '10'
      }
    };

    sinon
      .stub(SearchFeatureService.prototype, 'searchFeaturesByExpressionTreeWithCount')
      .resolves({ features: mockResults, properties: [], count: mockResults.length, has_more_secured_features: false });

    const requestHandler = search.searchFeatures();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockRes.statusValue).to.equal(200);
    // A visible secured row the caller CAN see must not, by itself, set has_more_secured_features.
    expect(mockRes.jsonValue).to.eql({
      features: mockResults,
      properties: [],
      pagination: {
        total: 1,
        per_page: 10,
        current_page: 1,
        last_page: 1,
        sort: undefined,
        order: undefined
      },
      has_more_secured_features: false
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
      pagination: { page: '1', limit: '10' }
    };

    sinon
      .stub(SearchFeatureService.prototype, 'searchFeaturesByExpressionTreeWithCount')
      .resolves({ features: [], properties: [], count: 0, has_more_secured_features: true });

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
        page: '2',
        limit: '5',
        sort: 'feature_type_name',
        order: 'asc'
      }
    };

    sinon
      .stub(SearchFeatureService.prototype, 'searchFeaturesByExpressionTreeWithCount')
      .resolves({ features: mockResults, properties: [], count: 25, has_more_secured_features: false });

    const requestHandler = search.searchFeatures();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql({
      features: mockResults,
      properties: [],
      pagination: {
        total: 25,
        per_page: 5,
        current_page: 2,
        last_page: 5,
        sort: 'feature_type_name',
        order: 'asc'
      },
      has_more_secured_features: false
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
        page: '1',
        limit: '10'
      }
    };

    sinon
      .stub(SearchFeatureService.prototype, 'searchFeaturesByExpressionTreeWithCount')
      .resolves({ features: [], properties: [], count: 0, has_more_secured_features: false });

    const requestHandler = search.searchFeatures();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql({
      features: [],
      properties: [],
      pagination: {
        total: 0,
        per_page: 10,
        current_page: 1,
        last_page: 1,
        sort: undefined,
        order: undefined
      },
      has_more_secured_features: false
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
        page: '1',
        limit: '10'
      }
    };

    const testError = new Error('Test error');
    sinon.stub(SearchFeatureService.prototype, 'searchFeaturesByExpressionTreeWithCount').rejects(testError);

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
      pagination: { page: '1', limit: '25' }
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
      .stub(SearchFeatureService.prototype, 'searchFeaturesByExpressionTreeWithCount')
      .resolves({ features: mockResults, properties: [], count: 37, has_more_secured_features: false });

    const requestHandler = search.searchFeatures();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(searchStub.firstCall.args[0]).to.equal('telemetry');
    expect(searchStub.firstCall.args[1]).to.equal(undefined);
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue.pagination).to.eql({
      total: 37,
      per_page: 25,
      current_page: 1,
      last_page: 2,
      sort: undefined,
      order: undefined
    });
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

    sinon
      .stub(SearchFeatureService.prototype, 'searchFeaturesByExpressionTreeWithCount')
      .resolves({ features: mockResults, properties: [], count: mockResults.length, has_more_secured_features: false });

    const requestHandler = search.searchFeatures();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql({
      features: mockResults,
      properties: [],
      pagination: {
        total: 1,
        per_page: 25,
        current_page: 1,
        last_page: 1,
        sort: undefined,
        order: undefined
      },
      has_more_secured_features: false
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
      pagination: { page: '1', limit: '10' }
    };

    const searchStub = sinon
      .stub(SearchFeatureService.prototype, 'searchFeaturesByExpressionTreeWithCount')
      .resolves({ features: [], properties: [], count: 0, has_more_secured_features: false });

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

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.keycloak_token = 'some-valid-token';
    mockReq.params = { feature_type: 'survey' };
    mockReq.body = {
      expression: expressionTree,
      pagination: { page: '1', limit: '10' }
    };

    const searchStub = sinon
      .stub(SearchFeatureService.prototype, 'searchFeaturesByExpressionTreeWithCount')
      .resolves({ features: [], properties: [], count: 0, has_more_secured_features: false });

    const requestHandler = search.searchFeatures();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(searchStub.firstCall.args[0]).to.equal('survey');
    expect(searchStub.firstCall.args[3]).to.equal(123);
  });
});
