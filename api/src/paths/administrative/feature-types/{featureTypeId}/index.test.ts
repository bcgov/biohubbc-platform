import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import * as db from '../../../../database/db';
import { FeatureType } from '../../../../models/feature-type';
import { FeatureTypeService } from '../../../../services/feature-type-service';
import { deleteFeatureType, getFeatureType, updateFeatureType } from './index';

chai.use(sinonChai);

const mockFeatureType: FeatureType = {
  feature_type_id: 1,
  name: 'survey',
  display_name: 'Survey',
  description: 'A survey feature type'
};

describe('getFeatureType', () => {
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
    mockReq.params = { featureTypeId: '1' };

    const requestHandler = getFeatureType();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as Error).message).to.equal('test error');
    }
  });

  it('should return 200 with feature type details', async () => {
    const mockDBConnection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
    sinon.stub(FeatureTypeService.prototype, 'getFeatureType').resolves(mockFeatureType);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { featureTypeId: '1' };

    const requestHandler = getFeatureType();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(mockFeatureType);
  });
});

describe('updateFeatureType', () => {
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
    mockReq.params = { featureTypeId: '1' };
    mockReq.body = { display_name: 'Updated Survey' };

    const requestHandler = updateFeatureType();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail('Expected error to be thrown');
    } catch (actualError) {
      expect((actualError as Error).message).to.equal('test error');
    }
  });

  it('should return 200 with updated feature type', async () => {
    const updatedMock: FeatureType = { ...mockFeatureType, display_name: 'Updated Survey' };

    const mockDBConnection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
    const updateStub = sinon.stub(FeatureTypeService.prototype, 'updateFeatureType').resolves(updatedMock);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { featureTypeId: '1' };
    mockReq.body = { display_name: 'Updated Survey' };

    const requestHandler = updateFeatureType();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(updateStub).to.have.been.calledWith(1, { display_name: 'Updated Survey' });
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(updatedMock);
  });
});

describe('deleteFeatureType', () => {
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
    mockReq.params = { featureTypeId: '1' };

    const requestHandler = deleteFeatureType();

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
    const deleteStub = sinon.stub(FeatureTypeService.prototype, 'deleteFeatureType').resolves();

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { featureTypeId: '1' };

    const requestHandler = deleteFeatureType();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(deleteStub).to.have.been.calledWith(1);
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql({ message: 'Feature type deleted successfully' });
  });
});
