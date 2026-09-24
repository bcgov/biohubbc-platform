import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../__mocks__/db';
import * as db from '../../../../../database/db';
import { AdminBlueprintFeatureType } from '../../../../../models/blueprint';
import { BlueprintService } from '../../../../../services/blueprint-service';
import { createBlueprintFeatureType, getBlueprintFeatureTypes } from './index';

chai.use(sinonChai);

const mockBlueprintFeatureType: AdminBlueprintFeatureType = {
  blueprint_feature_type_id: 5,
  blueprint_id: 8,
  feature_type_id: 10,
  feature_type_name: 'species_observation',
  feature_type_display_name: 'Species Observation',
  sort: null
};

describe('getBlueprintFeatureTypes', () => {
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
    mockReq.params = { blueprintId: '8' };

    const requestHandler = getBlueprintFeatureTypes();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as Error).message).to.equal('test error');
    }
  });

  it('should return 200 with the blueprint feature types', async () => {
    const mockDBConnection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
    const listStub = sinon
      .stub(BlueprintService.prototype, 'getAdminBlueprintFeatureTypes')
      .resolves([mockBlueprintFeatureType]);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { blueprintId: '8' };

    const requestHandler = getBlueprintFeatureTypes();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(listStub).to.have.been.calledOnceWith(8);
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql({ blueprint_feature_types: [mockBlueprintFeatureType] });
  });
});

describe('createBlueprintFeatureType', () => {
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
    mockReq.params = { blueprintId: '8' };
    mockReq.body = { feature_type_id: 10 };

    const requestHandler = createBlueprintFeatureType();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as Error).message).to.equal('test error');
    }
  });

  it('should return 201 with the created blueprint feature type', async () => {
    const mockDBConnection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
    const createStub = sinon
      .stub(BlueprintService.prototype, 'createBlueprintFeatureType')
      .resolves(mockBlueprintFeatureType);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { blueprintId: '8' };
    mockReq.body = { feature_type_id: 10, sort: 2 };

    const requestHandler = createBlueprintFeatureType();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(createStub).to.have.been.calledOnceWith(8, { feature_type_id: 10, sort: 2 });
    expect(mockRes.statusValue).to.equal(201);
    expect(mockRes.jsonValue).to.eql(mockBlueprintFeatureType);
  });
});
