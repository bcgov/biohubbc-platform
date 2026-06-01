import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import * as db from '../../../database/db';
import { FeatureProperty } from '../../../models/feature-property';
import { FeaturePropertyService } from '../../../services/feature-property-service';
import { createFeatureProperty, getFeatureProperties } from './index';

chai.use(sinonChai);

const mockFeatureProperty: FeatureProperty = {
  feature_property_id: 1,
  feature_property_type_id: 2,
  name: 'guid',
  display_name: 'GUID',
  description: 'The globally unique identifier for the record.',
  type_name: 'string',
  calculated_value: false
};

describe('getFeatureProperties', () => {
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

    const requestHandler = getFeatureProperties();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as Error).message).to.equal('test error');
    }
  });

  it('should return 200 with paginated feature properties', async () => {
    const mockFeatureProperties = [mockFeatureProperty];
    const mockResponse = {
      feature_properties: mockFeatureProperties,
      pagination: { total: 1, per_page: 50, current_page: 1, last_page: 1, sort: undefined, order: undefined }
    };

    const mockDBConnection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
    sinon.stub(FeaturePropertyService.prototype, 'getFeatureProperties').resolves(mockFeatureProperties);
    sinon.stub(FeaturePropertyService.prototype, 'getFeaturePropertiesCount').resolves(1);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.query = { page: '1', limit: '50' };

    const requestHandler = getFeatureProperties();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(mockResponse);
  });

  it('should filter by search parameter', async () => {
    const mockDBConnection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
    const getStub = sinon.stub(FeaturePropertyService.prototype, 'getFeatureProperties').resolves([]);
    const countStub = sinon.stub(FeaturePropertyService.prototype, 'getFeaturePropertiesCount').resolves(0);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.query = { page: '1', limit: '50', search: 'guid' };

    const requestHandler = getFeatureProperties();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(getStub).to.have.been.calledWith(
      { search: 'guid' },
      { page: 1, limit: 50, sort: undefined, order: undefined }
    );
    expect(countStub).to.have.been.calledWith({ search: 'guid' });
  });
});

describe('createFeatureProperty', () => {
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
    mockReq.body = { feature_property_type_id: 2, name: 'guid', display_name: 'GUID' };

    const requestHandler = createFeatureProperty();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as Error).message).to.equal('test error');
    }
  });

  it('should return 201 with created feature property', async () => {
    const mockDBConnection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
    const createStub = sinon
      .stub(FeaturePropertyService.prototype, 'createFeatureProperty')
      .resolves(mockFeatureProperty);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.body = {
      feature_property_type_id: 2,
      name: 'guid',
      display_name: 'GUID',
      description: 'The globally unique identifier for the record.',
      calculated_value: false
    };

    const requestHandler = createFeatureProperty();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(createStub).to.have.been.calledWith({
      feature_property_type_id: 2,
      name: 'guid',
      display_name: 'GUID',
      description: 'The globally unique identifier for the record.',
      calculated_value: false
    });
    expect(mockRes.statusValue).to.equal(201);
    expect(mockRes.jsonValue).to.eql(mockFeatureProperty);
  });

  it('should create feature property with minimal fields', async () => {
    const mockMinimal: FeatureProperty = {
      feature_property_id: 2,
      feature_property_type_id: 3,
      name: 'geometry',
      display_name: 'Geometry',
      description: null,
      type_name: 'spatial',
      calculated_value: false
    };

    const mockDBConnection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
    const createStub = sinon.stub(FeaturePropertyService.prototype, 'createFeatureProperty').resolves(mockMinimal);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.body = { feature_property_type_id: 3, name: 'geometry', display_name: 'Geometry' };

    const requestHandler = createFeatureProperty();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(createStub).to.have.been.calledWith({
      feature_property_type_id: 3,
      name: 'geometry',
      display_name: 'Geometry',
      description: undefined,
      calculated_value: undefined
    });
    expect(mockRes.statusValue).to.equal(201);
  });
});
