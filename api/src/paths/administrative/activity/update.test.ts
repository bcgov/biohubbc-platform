import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../database/db';
import { AdministrativeService } from '../../../services/administrative-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import * as update from './update';

chai.use(sinonChai);

describe('update', () => {
  afterEach(() => {
    sinon.restore();
  });

  const sampleReq = {
    keycloak_token: {},
    body: {
      id: 1,
      status: 2
    }
  } as any;

  it('should return 200 after update is completed', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });

    sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.body = sampleReq.body;

    const mockUpdateAdministrativeActivity = sinon
      .stub(AdministrativeService.prototype, 'updateAdministrativeActivity')
      .resolves();

    const requestHandler = update.getUpdateAdministrativeActivityHandler();

    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockUpdateAdministrativeActivity).to.have.been.calledOnce;
    expect(mockRes.statusValue).to.equal(200);
  });
});
