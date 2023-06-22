import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../database/db';
import { HTTPError } from '../../../errors/http-error';
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

  it('re-throws any error that is thrown', async () => {
    const mockDBConnection = getMockDBConnection({
      open: () => {
        throw new Error('test error');
      }
    });

    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.body = {
      userIdentifier: 1,
      identitySource: 'identitySource',
      requestId: 1,
      requestStatusTypeId: 1,
      roleIds: [1, 3]
    };

    const requestHandler = update.getUpdateAdministrativeActivityHandler();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as HTTPError).message).to.equal('test error');
    }
  });

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
