import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../../__mocks__/db';
import * as db from '../../../../../../database/db';
import { AdminFeatureTypeProperty } from '../../../../../../models/feature-type-property';
import { FeatureTypePropertyService } from '../../../../../../services/feature-type-property-service';
import { deleteFeatureTypeProperty, getFeatureTypeProperty, updateFeatureTypeProperty } from './index';

chai.use(sinonChai);

const mockAdminFeatureTypeProperty: AdminFeatureTypeProperty = {
  feature_type_property_id: 1,
  feature_type_id: 10,
  feature_property_id: 20,
  required_value: false,
  sort: null
};

describe('getFeatureTypeProperty', () => {
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
    mockReq.params = { featureTypeId: '10', featureTypePropertyId: '1' };

    const requestHandler = getFeatureTypeProperty();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as Error).message).to.equal('test error');
    }
  });

  it('should return 200 with feature type property', async () => {
    const mockDBConnection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
    const getStub = sinon
      .stub(FeatureTypePropertyService.prototype, 'getAdminFeatureTypeProperty')
      .resolves(mockAdminFeatureTypeProperty);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { featureTypeId: '10', featureTypePropertyId: '1' };

    const requestHandler = getFeatureTypeProperty();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(getStub).to.have.been.calledWith(1, 10);
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(mockAdminFeatureTypeProperty);
  });
});

describe('updateFeatureTypeProperty', () => {
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
    mockReq.params = { featureTypeId: '10', featureTypePropertyId: '1' };
    mockReq.body = { required_value: true };

    const requestHandler = updateFeatureTypeProperty();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as Error).message).to.equal('test error');
    }
  });

  it('should return 200 with updated feature type property', async () => {
    const updated: AdminFeatureTypeProperty = { ...mockAdminFeatureTypeProperty, required_value: true };

    const mockDBConnection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
    const updateStub = sinon.stub(FeatureTypePropertyService.prototype, 'updateFeatureTypeProperty').resolves(updated);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { featureTypeId: '10', featureTypePropertyId: '1' };
    mockReq.body = { required_value: true };

    const requestHandler = updateFeatureTypeProperty();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(updateStub).to.have.been.calledWith(1, 10, { required_value: true });
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(updated);
  });
});

describe('deleteFeatureTypeProperty', () => {
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
    mockReq.params = { featureTypeId: '10', featureTypePropertyId: '1' };

    const requestHandler = deleteFeatureTypeProperty();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as Error).message).to.equal('test error');
    }
  });

  it('should return 200 with success message', async () => {
    const mockDBConnection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
    const deleteStub = sinon.stub(FeatureTypePropertyService.prototype, 'deleteFeatureTypeProperty').resolves();

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { featureTypeId: '10', featureTypePropertyId: '1' };

    const requestHandler = deleteFeatureTypeProperty();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(deleteStub).to.have.been.calledWith(1, 10);
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql({ message: 'Feature type property deleted successfully' });
  });
});
