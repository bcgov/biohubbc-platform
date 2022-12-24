import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../database/db';
import { HTTP500 } from '../../../errors/http-error';
import { AdministrativeService } from '../../../services/administrative-service';
import { GCNotifyService } from '../../../services/gcnotify-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import * as create from './create';

chai.use(sinonChai);

describe('create', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('should throw a 400 error when no system user id', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub(),
      systemUserId: () => 0
    });

    sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    const requestHandler = create.createAdministrativeActivity();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as HTTP500).message).to.equal('Failed to identify system user ID');
    }
  });

  it('should return 200 when create completes', async () => {
    const dbConnectionObj = getMockDBConnection({ systemUserId: () => 1 });

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);

    const createAdministrativeActivityStub = sinon
      .stub(AdministrativeService.prototype, 'createAdministrativeActivity')
      .resolves({ id: 1, create_date: 'date' });

    sinon.stub(GCNotifyService.prototype, 'sendAccessRequestReceivedEmail').resolves();

    const requestHandler = create.createAdministrativeActivity();

    await requestHandler(mockReq, mockRes, mockNext);

    expect(createAdministrativeActivityStub).to.have.been.calledOnce;
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql({ id: 1, date: 'date' });
  });
});
