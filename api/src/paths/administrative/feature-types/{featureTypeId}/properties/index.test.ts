import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../__mocks__/db';
import * as db from '../../../../../database/db';
import { AdminFeatureTypeProperty } from '../../../../../models/feature-type-property';
import { FeatureTypePropertyService } from '../../../../../services/feature-type-property-service';
import { createFeatureTypeProperty, getFeatureTypeProperties } from './index';

chai.use(sinonChai);

const mockAdminFeatureTypeProperty: AdminFeatureTypeProperty = {
  feature_type_property_id: 1,
  feature_type_id: 10,
  feature_property_id: 20,
  required_value: false,
  sort: null
};

describe('getFeatureTypeProperties', () => {
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
    mockReq.params = { featureTypeId: '10' };
    mockReq.query = { page: '1', limit: '50' };

    const requestHandler = getFeatureTypeProperties();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as Error).message).to.equal('test error');
    }
  });

  it('should return 200 with paginated feature type properties', async () => {
    const mockProperties = [mockAdminFeatureTypeProperty];
    const mockResponse = {
      feature_type_properties: mockProperties,
      pagination: { total: 1, per_page: 50, current_page: 1, last_page: 1, sort: undefined, order: undefined }
    };

    const mockDBConnection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
    sinon.stub(FeatureTypePropertyService.prototype, 'getAdminFeatureTypeProperties').resolves(mockProperties);
    sinon.stub(FeatureTypePropertyService.prototype, 'getAdminFeatureTypePropertiesCount').resolves(1);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { featureTypeId: '10' };
    mockReq.query = { page: '1', limit: '50' };

    const requestHandler = getFeatureTypeProperties();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(mockResponse);
  });
});

describe('createFeatureTypeProperty', () => {
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
    mockReq.params = { featureTypeId: '10' };
    mockReq.body = { feature_property_id: 20 };

    const requestHandler = createFeatureTypeProperty();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as Error).message).to.equal('test error');
    }
  });

  it('should return 201 with created feature type property', async () => {
    const mockDBConnection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
    const createStub = sinon
      .stub(FeatureTypePropertyService.prototype, 'createFeatureTypeProperty')
      .resolves(mockAdminFeatureTypeProperty);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { featureTypeId: '10' };
    mockReq.body = { feature_property_id: 20, required_value: false, sort: null };

    const requestHandler = createFeatureTypeProperty();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(createStub).to.have.been.calledWith({
      feature_type_id: 10,
      feature_property_id: 20,
      required_value: false,
      sort: null
    });
    expect(mockRes.statusValue).to.equal(201);
    expect(mockRes.jsonValue).to.eql(mockAdminFeatureTypeProperty);
  });

  it('should create feature type property with minimal fields', async () => {
    const mockMinimal: AdminFeatureTypeProperty = {
      feature_type_property_id: 2,
      feature_type_id: 10,
      feature_property_id: 30,
      required_value: false,
      sort: null
    };

    const mockDBConnection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
    const createStub = sinon
      .stub(FeatureTypePropertyService.prototype, 'createFeatureTypeProperty')
      .resolves(mockMinimal);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { featureTypeId: '10' };
    mockReq.body = { feature_property_id: 30 };

    const requestHandler = createFeatureTypeProperty();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(createStub).to.have.been.calledWith({
      feature_type_id: 10,
      feature_property_id: 30,
      required_value: undefined,
      sort: undefined
    });
    expect(mockRes.statusValue).to.equal(201);
  });
});
