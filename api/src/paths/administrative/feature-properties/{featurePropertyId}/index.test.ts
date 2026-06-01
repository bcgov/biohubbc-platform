import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import * as db from '../../../../database/db';
import { FeatureProperty } from '../../../../models/feature-property';
import { FeaturePropertyService } from '../../../../services/feature-property-service';
import { deleteFeatureProperty, getFeatureProperty, updateFeatureProperty } from './index';

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

describe('getFeatureProperty', () => {
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
    mockReq.params = { featurePropertyId: '1' };

    const requestHandler = getFeatureProperty();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as Error).message).to.equal('test error');
    }
  });

  it('should return 200 with feature property details', async () => {
    const mockDBConnection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
    sinon.stub(FeaturePropertyService.prototype, 'getFeatureProperty').resolves(mockFeatureProperty);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { featurePropertyId: '1' };

    const requestHandler = getFeatureProperty();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(mockFeatureProperty);
  });
});

describe('updateFeatureProperty', () => {
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
    mockReq.params = { featurePropertyId: '1' };
    mockReq.body = { display_name: 'Updated GUID' };

    const requestHandler = updateFeatureProperty();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail('Expected error to be thrown');
    } catch (actualError) {
      expect((actualError as Error).message).to.equal('test error');
    }
  });

  it('should return 200 with updated feature property', async () => {
    const updatedMock: FeatureProperty = { ...mockFeatureProperty, display_name: 'Updated GUID' };

    const mockDBConnection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
    const updateStub = sinon.stub(FeaturePropertyService.prototype, 'updateFeatureProperty').resolves(updatedMock);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { featurePropertyId: '1' };
    mockReq.body = { display_name: 'Updated GUID' };

    const requestHandler = updateFeatureProperty();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(updateStub).to.have.been.calledWith(1, { display_name: 'Updated GUID' });
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(updatedMock);
  });
});

describe('deleteFeatureProperty', () => {
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
    mockReq.params = { featurePropertyId: '1' };

    const requestHandler = deleteFeatureProperty();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as Error).message).to.equal('test error');
    }
  });

  it('should return 200 on successful delete', async () => {
    const mockDBConnection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
    const deleteStub = sinon.stub(FeaturePropertyService.prototype, 'deleteFeatureProperty').resolves();

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { featurePropertyId: '1' };

    const requestHandler = deleteFeatureProperty();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(deleteStub).to.have.been.calledWith(1);
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql({ message: 'Feature property deleted successfully' });
  });
});
