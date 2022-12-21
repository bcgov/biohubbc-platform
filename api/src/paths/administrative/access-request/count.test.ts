import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../database/db';
import { HTTP400 } from '../../../errors/http-error';
import { AdministrativeService } from '../../../services/administrative-service';
import * as userIdentifier from '../../../utils/keycloak-utils';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import * as count from './count';

chai.use(sinonChai);

describe('count', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('should throw a 400 error when no user identifier', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });

    sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);
    sinon.stub(userIdentifier, 'getUserIdentifier').returns(null);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    const requestHandler = count.getPendingAccessRequestsCount();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as HTTP400).message).to.equal('Missing required userIdentifier');
    }
  });

  it('should return 0 on success (no rowCount)', async () => {
    const dbConnectionObj = getMockDBConnection({ systemUserId: () => 1 });

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);
    sinon.stub(userIdentifier, 'getUserIdentifier').returns('string');

    const getPendingAccessRequestCountStub = sinon
      .stub(AdministrativeService.prototype, 'getPendingAccessRequestCount')
      .resolves(0);

    const requestHandler = count.getPendingAccessRequestsCount();

    await requestHandler(mockReq, mockRes, mockNext);

    expect(getPendingAccessRequestCountStub).to.have.been.calledOnce;
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(0);
  });

  it('should return rowCount on success', async () => {
    const dbConnectionObj = getMockDBConnection({ systemUserId: () => 1 });

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);
    sinon.stub(userIdentifier, 'getUserIdentifier').returns('string');

    const getPendingAccessRequestCountStub = sinon
      .stub(AdministrativeService.prototype, 'getPendingAccessRequestCount')
      .resolves(2);

    const requestHandler = count.getPendingAccessRequestsCount();

    await requestHandler(mockReq, mockRes, mockNext);

    expect(getPendingAccessRequestCountStub).to.have.been.calledOnce;
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(2);
  });
});
