import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../../__mocks__/db';
import * as db from '../../../../../../database/db';
import { AdminBlueprintFeatureType } from '../../../../../../models/blueprint';
import { BlueprintService } from '../../../../../../services/blueprint-service';
import { deleteBlueprintFeatureType, updateBlueprintFeatureType } from './index';

chai.use(sinonChai);

const mockBlueprintFeatureType: AdminBlueprintFeatureType = {
  blueprint_feature_type_id: 5,
  blueprint_id: 8,
  feature_type_id: 10,
  feature_type_name: 'species_observation',
  feature_type_display_name: 'Species Observation',
  sort: null
};

describe('updateBlueprintFeatureType', () => {
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
    mockReq.body = { sort: 2 };

    const requestHandler = updateBlueprintFeatureType();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as Error).message).to.equal('test error');
    }
  });

  it('should return 200 with the updated blueprint feature type', async () => {
    const mockDBConnection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
    const updateStub = sinon
      .stub(BlueprintService.prototype, 'updateBlueprintFeatureType')
      .resolves(mockBlueprintFeatureType);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { blueprintId: '8', blueprintFeatureTypeId: '5' };
    mockReq.body = { sort: 2 };

    const requestHandler = updateBlueprintFeatureType();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(updateStub).to.have.been.calledOnceWith(8, 5, { sort: 2 });
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(mockBlueprintFeatureType);
  });
});

describe('deleteBlueprintFeatureType', () => {
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

    const requestHandler = deleteBlueprintFeatureType();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as Error).message).to.equal('test error');
    }
  });

  it('should return 200 when the blueprint feature type is deleted', async () => {
    const mockDBConnection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
    const deleteStub = sinon.stub(BlueprintService.prototype, 'deleteBlueprintFeatureType').resolves();

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { blueprintId: '8', blueprintFeatureTypeId: '5' };

    const requestHandler = deleteBlueprintFeatureType();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(deleteStub).to.have.been.calledOnceWith(8, 5);
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql({ message: 'Blueprint feature type deleted successfully' });
  });
});
