import chai, { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';

import { registerNewContributor } from '.';
import * as db from '../../database/db';
import { HTTPError } from '../../errors/http-error';
import { SystemUser } from '../../repositories/user-repository';
import { ContributorService } from '../../services/contributor-service';
import * as keycloakUtils from '../../utils/keycloak-utils';
import { getMockDBConnection, getRequestHandlerMocks } from '../../__mocks__/db';

chai.use(sinonChai);

describe('registerNewContributor', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('throws HTTP400 if service client system user is not found', async () => {
    const mockDBConnection = getMockDBConnection({ open: sinon.stub(), commit: sinon.stub(), release: sinon.stub() });
    sinon.stub(db, 'getServiceAccountDBConnection').returns(mockDBConnection);
    sinon.stub(keycloakUtils, 'getServiceClientSystemUser').returns(null);

    const requestHandler = registerNewContributor();

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (error) {
      expect((error as HTTPError).status).to.equal(400);
      expect((error as HTTPError).message).to.equal('Failed to identify known submission source system');
    }
  });

  it('calls ContributorService and returns 201 on success', async () => {
    const mockDBConnection = getMockDBConnection({
      commit: sinon.stub(),
      release: sinon.stub(),
      rollback: sinon.stub()
    });
    sinon.stub(db, 'getServiceAccountDBConnection').returns(mockDBConnection);

    const mockSystemUser = {
      system_user_id: 42
    } as SystemUser;

    sinon.stub(keycloakUtils, 'getServiceClientSystemUser').returns(mockSystemUser);

    const addNewContributorStub = sinon.stub(ContributorService.prototype, 'addNewContributor').resolves();

    const requestHandler = registerNewContributor();

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq['keycloak_token'] = { clientId: 'some-client-id' };

    await requestHandler(mockReq, mockRes, mockNext);

    expect(addNewContributorStub).to.have.been.calledOnceWith({
      clientId: 'some-client-id',
      members: [{ system_user_id: 42 }]
    });

    expect(mockDBConnection.commit).to.have.been.calledOnce;
    expect(mockDBConnection.rollback).to.not.have.been.called;
    expect(mockRes.statusValue).to.equal(201);
  });

  it('rolls back and rethrows error if ContributorService fails', async () => {
    const mockDBConnection = getMockDBConnection({
      release: sinon.stub(),
      commit: sinon.stub(),
      rollback: sinon.stub()
    });

    sinon.stub(db, 'getServiceAccountDBConnection').returns(mockDBConnection);

    const mockSystemUser = {
      system_user_id: 42
    } as SystemUser;

    sinon.stub(keycloakUtils, 'getServiceClientSystemUser').returns(mockSystemUser);
    sinon.stub(ContributorService.prototype, 'addNewContributor').rejects(new Error('Contributor error'));

    const requestHandler = registerNewContributor();

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq['keycloak_token'] = { clientId: 'some-client-id' };

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (error) {
      expect(mockDBConnection.rollback).to.have.been.calledOnce;
      expect((error as Error).message).to.equal('Contributor error');
    }
  });
});
