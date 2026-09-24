import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../../../../__mocks__/db';
import * as db from '../../../../../../../../database/db';
import { AdminBlueprintFeatureTypeProperty } from '../../../../../../../../models/blueprint';
import { BlueprintService } from '../../../../../../../../services/blueprint-service';
import {
  deleteBlueprintFeatureTypeProperty,
  getBlueprintFeatureTypeProperty,
  updateBlueprintFeatureTypeProperty
} from './index';

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

describe('getBlueprintFeatureTypeProperty', () => {
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
    mockReq.params = { blueprintId: '8', blueprintFeatureTypeId: '5', blueprintFeatureTypePropertyId: '3' };

    const requestHandler = getBlueprintFeatureTypeProperty();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as Error).message).to.equal('test error');
    }
  });

  it('should return 200 with the assignment', async () => {
    const mockDBConnection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
    const getStub = sinon
      .stub(BlueprintService.prototype, 'getAdminBlueprintFeatureTypeProperty')
      .resolves(mockBlueprintFeatureTypeProperty);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { blueprintId: '8', blueprintFeatureTypeId: '5', blueprintFeatureTypePropertyId: '3' };

    const requestHandler = getBlueprintFeatureTypeProperty();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(getStub).to.have.been.calledOnceWith(8, 5, 3);
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(mockBlueprintFeatureTypeProperty);
  });
});

describe('updateBlueprintFeatureTypeProperty', () => {
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
    mockReq.params = { blueprintId: '8', blueprintFeatureTypeId: '5', blueprintFeatureTypePropertyId: '3' };
    mockReq.body = { required_value: false };

    const requestHandler = updateBlueprintFeatureTypeProperty();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as Error).message).to.equal('test error');
    }
  });

  it('should return 200 with the updated assignment', async () => {
    const mockDBConnection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
    const updateStub = sinon
      .stub(BlueprintService.prototype, 'updateBlueprintFeatureTypeProperty')
      .resolves(mockBlueprintFeatureTypeProperty);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { blueprintId: '8', blueprintFeatureTypeId: '5', blueprintFeatureTypePropertyId: '3' };
    mockReq.body = { required_value: false, allow_multiple: true, sort: 4 };

    const requestHandler = updateBlueprintFeatureTypeProperty();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(updateStub).to.have.been.calledOnceWith(8, 5, 3, { required_value: false, allow_multiple: true, sort: 4 });
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(mockBlueprintFeatureTypeProperty);
  });
});

describe('deleteBlueprintFeatureTypeProperty', () => {
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
    mockReq.params = { blueprintId: '8', blueprintFeatureTypeId: '5', blueprintFeatureTypePropertyId: '3' };

    const requestHandler = deleteBlueprintFeatureTypeProperty();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as Error).message).to.equal('test error');
    }
  });

  it('should return 200 when the assignment is deleted', async () => {
    const mockDBConnection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
    const deleteStub = sinon.stub(BlueprintService.prototype, 'deleteBlueprintFeatureTypeProperty').resolves();

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { blueprintId: '8', blueprintFeatureTypeId: '5', blueprintFeatureTypePropertyId: '3' };

    const requestHandler = deleteBlueprintFeatureTypeProperty();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(deleteStub).to.have.been.calledOnceWith(8, 5, 3);
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql({ message: 'Blueprint feature type property deleted successfully' });
  });
});
