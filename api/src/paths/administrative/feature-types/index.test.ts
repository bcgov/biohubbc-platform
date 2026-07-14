import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import * as db from '../../../database/db';
import { FeatureType } from '../../../models/feature-type';
import { FeatureTypeService } from '../../../services/feature-type-service';
import { createFeatureType, getFeatureTypes } from './index';

chai.use(sinonChai);

const mockFeatureType: FeatureType = {
  feature_type_id: 1,
  name: 'survey',
  display_name: 'Survey',
  description: 'A survey feature type'
};

describe('getFeatureTypes', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('re-throws any error that is thrown', async () => {
    const mockDBConnection = getMockDBConnection({
      open: () => {
        throw new Error('test error');
      }
    });

    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.query = { page: '1', limit: '50' };

    const requestHandler = getFeatureTypes();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as Error).message).to.equal('test error');
    }
  });

  it('should return 200 with paginated feature types', async () => {
    const mockFeatureTypes = [mockFeatureType];
    const mockResponse = {
      feature_types: mockFeatureTypes,
      pagination: { total: 1, per_page: 50, current_page: 1, last_page: 1, sort: undefined, order: undefined }
    };

    const mockDBConnection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
    sinon.stub(FeatureTypeService.prototype, 'getFeatureTypes').resolves(mockFeatureTypes);
    sinon.stub(FeatureTypeService.prototype, 'getFeatureTypesCount').resolves(1);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.query = { page: '1', limit: '50' };

    const requestHandler = getFeatureTypes();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(mockResponse);
  });

  it('should filter by search parameter', async () => {
    const mockDBConnection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
    const getFeatureTypesStub = sinon.stub(FeatureTypeService.prototype, 'getFeatureTypes').resolves([]);
    const getFeatureTypesCountStub = sinon.stub(FeatureTypeService.prototype, 'getFeatureTypesCount').resolves(0);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.query = { page: '1', limit: '50', search: 'survey' };

    const requestHandler = getFeatureTypes();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(getFeatureTypesStub).to.have.been.calledWith(
      { search: 'survey' },
      {
        page: 1,
        limit: 50,
        sort: undefined,
        order: undefined
      }
    );
    expect(getFeatureTypesCountStub).to.have.been.calledWith({ search: 'survey' });
  });
});

describe('createFeatureType', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('re-throws any error that is thrown', async () => {
    const mockDBConnection = getMockDBConnection({
      open: () => {
        throw new Error('test error');
      }
    });

    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.body = { name: 'survey', display_name: 'Survey' };

    const requestHandler = createFeatureType();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as Error).message).to.equal('test error');
    }
  });

  it('should return 201 with created feature type', async () => {
    const mockDBConnection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
    const createStub = sinon.stub(FeatureTypeService.prototype, 'createFeatureType').resolves(mockFeatureType);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.body = { name: 'survey', display_name: 'Survey', description: 'A survey feature type' };

    const requestHandler = createFeatureType();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(createStub).to.have.been.calledWith({
      name: 'survey',
      display_name: 'Survey',
      description: 'A survey feature type'
    });
    expect(mockRes.statusValue).to.equal(201);
    expect(mockRes.jsonValue).to.eql(mockFeatureType);
  });

  it('should create feature type with minimal fields', async () => {
    const mockMinimal: FeatureType = {
      feature_type_id: 2,
      name: 'observation',
      display_name: 'Observation',
      description: null
    };

    const mockDBConnection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
    const createStub = sinon.stub(FeatureTypeService.prototype, 'createFeatureType').resolves(mockMinimal);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.body = { name: 'observation', display_name: 'Observation' };

    const requestHandler = createFeatureType();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(createStub).to.have.been.calledWith({
      name: 'observation',
      display_name: 'Observation',
      description: undefined
    });
    expect(mockRes.statusValue).to.equal(201);
  });
});
