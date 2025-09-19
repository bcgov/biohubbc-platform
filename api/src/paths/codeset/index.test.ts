import chai, { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { submitCodeset } from '.';
import * as db from '../../database/db';
import { HTTP400 } from '../../errors/http-error';
import { SystemUser } from '../../repositories/user-repository';
import { ContributorCodesetService } from '../../services/contributor-codeset-service';
import * as keycloakUtils from '../../utils/keycloak-utils';
import { getMockDBConnection, getRequestHandlerMocks } from '../../__mocks__/db';

chai.use(sinonChai);

describe('submitCodeSet', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('throws HTTP400 if service client system user is not found', async () => {
    const mockDBConnection = getMockDBConnection({
      release: sinon.stub(),
      commit: sinon.stub(),
      rollback: sinon.stub()
    });

    sinon.stub(db, 'getServiceAccountDBConnection').returns(mockDBConnection);
    sinon.stub(keycloakUtils, 'getServiceClientSystemUser').returns(null);

    const requestHandler = submitCodeset();

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail('Should have thrown HTTP400');
    } catch (error) {
      expect(error).to.be.instanceOf(HTTP400);
      expect((error as HTTP400).message).to.equal('Failed to identify known submission source system');
    }
  });

  it('calls service and returns 201 on success', async () => {
    const mockDBConnection = getMockDBConnection({
      release: sinon.stub(),
      commit: sinon.stub(),
      rollback: sinon.stub()
    });

    sinon.stub(db, 'getServiceAccountDBConnection').returns(mockDBConnection);

    const mockSystemUser = { system_user_id: 123 } as SystemUser;
    sinon.stub(keycloakUtils, 'getServiceClientSystemUser').returns(mockSystemUser);

    const upsertStub = sinon.stub(ContributorCodesetService.prototype, 'upsertCodeset').resolves();

    const requestHandler = submitCodeset();

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq['keycloak_token'] = { clientId: 'some-client-id' };

    mockReq.body = {
      categories: [
        {
          name: 'temperature',
          description: 'desc',
          codes: [{ label: 'hot', value: 1 }]
        }
      ]
    };

    await requestHandler(mockReq, mockRes, mockNext);

    expect(upsertStub).to.have.been.calledOnceWith({
      clientId: 'some-client-id',
      categories: [
        {
          name: 'temperature',
          description: 'desc',
          codes: [{ label: 'hot', value: 1 }]
        }
      ]
    });

    expect(mockDBConnection.commit).to.have.been.calledOnce;
    expect(mockDBConnection.rollback).to.not.have.been.called;
    expect(mockRes.sendStatusValue).to.equal(201);
  });

  it('rolls back and rethrows error if service fails', async () => {
    const mockDBConnection = getMockDBConnection({
      release: sinon.stub(),
      commit: sinon.stub(),
      rollback: sinon.stub()
    });
    sinon.stub(db, 'getServiceAccountDBConnection').returns(mockDBConnection);

    const mockSystemUser = { system_user_id: 123 } as SystemUser;
    sinon.stub(keycloakUtils, 'getServiceClientSystemUser').returns(mockSystemUser);

    sinon.stub(ContributorCodesetService.prototype, 'upsertCodeset').rejects(new Error('Service failure'));

    const requestHandler = submitCodeset();

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq['keycloak_token'] = { clientId: 'some-client-id' };

    mockReq.body = {
      categories: []
    };

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail('Should have thrown error');
    } catch (error) {
      expect(mockDBConnection.rollback).to.have.been.calledOnce;
      expect((error as Error).message).to.equal('Service failure');
    }
  });
});
