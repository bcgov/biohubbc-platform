import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import * as db from '../../../../database/db';
import { AdminBlueprint } from '../../../../models/blueprint';
import { BlueprintService } from '../../../../services/blueprint-service';
import { getBlueprint } from './index';

chai.use(sinonChai);

const mockBlueprint: AdminBlueprint = {
  blueprint_id: 8,
  version_number: 2,
  name: 'Default Blueprint',
  description: null,
  is_default: false,
  parent_blueprint_id: 7,
  record_effective_date: null,
  record_end_date: null
};

describe('getBlueprint', () => {
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

    const requestHandler = getBlueprint();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as Error).message).to.equal('test error');
    }
  });

  it('should return 200 with the blueprint', async () => {
    const mockDBConnection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
    const getStub = sinon.stub(BlueprintService.prototype, 'getAdminBlueprint').resolves(mockBlueprint);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { blueprintId: '8' };

    const requestHandler = getBlueprint();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(getStub).to.have.been.calledOnceWith(8);
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(mockBlueprint);
  });
});
