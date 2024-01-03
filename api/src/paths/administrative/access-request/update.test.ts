import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../database/db';
import { HTTPError } from '../../../errors/http-error';
import { SystemUserExtended } from '../../../repositories/user-repository';
import { AdministrativeService } from '../../../services/administrative-service';
import { GCNotifyService } from '../../../services/gcnotify-service';
import { UserService } from '../../../services/user-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import * as update from './update';

chai.use(sinonChai);

describe('updateAccessRequest', () => {
  afterEach(() => {
    sinon.restore();
  });

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

    const requestHandler = update.updateAccessRequest();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as HTTPError).message).to.equal('test error');
    }
  });

  it('adds new system roles and updates administrative activity', async () => {
    const mockDBConnection = getMockDBConnection();

    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    const requestId = 1;
    const requestStatusTypeId = 2;
    const roleIdsToAdd = [1, 3];

    mockReq.body = {
      userIdentifier: 'username',
      identitySource: 'identitySource',
      requestId: requestId,
      requestStatusTypeId: requestStatusTypeId,
      roleIds: roleIdsToAdd
    };

    const systemUserId = 4;
    const existingRoleIds = [1, 2];
    const mockSystemUser: SystemUserExtended = {
      system_user_id: systemUserId,
      user_identity_source_id: 2,
      user_identifier: 'username',
      user_guid: '',
      record_end_date: '',
      record_effective_date: '2023-12-08',
      create_date: '2023-12-08 14:37:41.315999-08',
      create_user: 1,
      update_date: null,
      update_user: null,
      revision_count: 0,
      identity_source: 'identitySource',
      role_ids: existingRoleIds,
      role_names: []
    };
    const ensureSystemUserStub = sinon.stub(UserService.prototype, 'ensureSystemUser').resolves(mockSystemUser);

    const addSystemRolesStub = sinon.stub(UserService.prototype, 'addUserSystemRoles');

    const updateAdministrativeActivityStub = sinon.stub(
      AdministrativeService.prototype,
      'updateAdministrativeActivity'
    );

    const sendApprovalEmailStub = sinon.stub(GCNotifyService.prototype, 'sendApprovalEmail');

    const requestHandler = update.updateAccessRequest();

    await requestHandler(mockReq, mockRes, mockNext);

    const expectedRoleIdsToAdd = [3];

    expect(ensureSystemUserStub).to.have.been.calledOnce;
    expect(addSystemRolesStub).to.have.been.calledWith(systemUserId, expectedRoleIdsToAdd);
    expect(updateAdministrativeActivityStub).to.have.been.calledWith(requestId, requestStatusTypeId);
    expect(sendApprovalEmailStub).to.have.been.calledWith(requestStatusTypeId, 'username', 'identitySource');
  });
});
