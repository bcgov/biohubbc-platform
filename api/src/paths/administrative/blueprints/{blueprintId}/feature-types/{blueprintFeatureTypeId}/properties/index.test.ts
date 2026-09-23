import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../../../__mocks__/db';
import * as db from '../../../../../../../database/db';
import { AdminBlueprintFeatureTypeProperty } from '../../../../../../../models/blueprint';
import { BlueprintService } from '../../../../../../../services/blueprint-service';
import { createBlueprintFeatureTypeProperty, getBlueprintFeatureTypeProperties } from './index';

chai.use(sinonChai);

const mockBlueprintFeatureTypeProperty: AdminBlueprintFeatureTypeProperty = {
  blueprint_feature_type_property_id: 3,
  blueprint_feature_type_id: 5,
  feature_property_id: 20,
  property_name: 'latitude',
  property_display_name: 'Latitude',
  property_type_name: 'number',
  required_value: true,
  allow_multiple: false,
  sort: 1
};

describe('getBlueprintFeatureTypeProperties', () => {
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
    mockReq.params = { blueprintId: '8', blueprintFeatureTypeId: '5' };
    mockReq.query = { page: '1', limit: '50' };

    const requestHandler = getBlueprintFeatureTypeProperties();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as Error).message).to.equal('test error');
    }
  });

  it('should return 200 with paginated blueprint feature type properties', async () => {
    const mockDBConnection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
    const listStub = sinon
      .stub(BlueprintService.prototype, 'getAdminBlueprintFeatureTypeProperties')
      .resolves([mockBlueprintFeatureTypeProperty]);
    sinon.stub(BlueprintService.prototype, 'getAdminBlueprintFeatureTypePropertiesCount').resolves(1);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { blueprintId: '8', blueprintFeatureTypeId: '5' };
    mockReq.query = { page: '1', limit: '50' };

    const requestHandler = getBlueprintFeatureTypeProperties();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(listStub.firstCall.args[0]).to.equal(8);
    expect(listStub.firstCall.args[1]).to.equal(5);
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql({
      blueprint_feature_type_properties: [mockBlueprintFeatureTypeProperty],
      pagination: { total: 1, per_page: 50, current_page: 1, last_page: 1, sort: undefined, order: undefined }
    });
  });
});

describe('createBlueprintFeatureTypeProperty', () => {
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
    mockReq.params = { blueprintId: '8', blueprintFeatureTypeId: '5' };
    mockReq.body = { feature_property_id: 20 };

    const requestHandler = createBlueprintFeatureTypeProperty();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as Error).message).to.equal('test error');
    }
  });

  it('should return 201 with the created assignment', async () => {
    const mockDBConnection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
    const createStub = sinon
      .stub(BlueprintService.prototype, 'createBlueprintFeatureTypeProperty')
      .resolves(mockBlueprintFeatureTypeProperty);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { blueprintId: '8', blueprintFeatureTypeId: '5' };
    mockReq.body = { feature_property_id: 20, required_value: true, allow_multiple: false, sort: 1 };

    const requestHandler = createBlueprintFeatureTypeProperty();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(createStub).to.have.been.calledOnceWith(8, 5, {
      feature_property_id: 20,
      required_value: true,
      allow_multiple: false,
      sort: 1
    });
    expect(mockRes.statusValue).to.equal(201);
    expect(mockRes.jsonValue).to.eql(mockBlueprintFeatureTypeProperty);
  });

  it('should assign a property by feature_property_id alone', async () => {
    const mockDBConnection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
    const createStub = sinon
      .stub(BlueprintService.prototype, 'createBlueprintFeatureTypeProperty')
      .resolves(mockBlueprintFeatureTypeProperty);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { blueprintId: '8', blueprintFeatureTypeId: '5' };
    mockReq.body = { feature_property_id: 20 };

    const requestHandler = createBlueprintFeatureTypeProperty();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(createStub).to.have.been.calledOnceWith(8, 5, {
      feature_property_id: 20,
      required_value: undefined,
      allow_multiple: undefined,
      sort: undefined
    });
    expect(mockRes.statusValue).to.equal(201);
  });
});
