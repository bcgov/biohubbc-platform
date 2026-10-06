import chai, { expect } from 'chai';
import { RequestHandler } from 'express';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../__mocks__/db';
import { SYSTEM_ROLE } from '../../constants/roles';
import * as db from '../../database/db';
import { HTTP403 } from '../../errors/http-error';
import { SystemUserExtended } from '../../models/system-user';
import { authorizationDependencies } from '../../request-handlers/security/authorization';
import { ArtifactService } from '../../services/old-artifact-service';
import * as path from './delete';

chai.use(sinonChai);

describe('delete artifact', () => {
  describe('deleteArtifact', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('catches and throws error', async () => {
      const dbConnectionObj = getMockDBConnection({ rollback: sinon.stub(), release: sinon.stub() });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);
      sinon.stub(path.deleteArtifactDependencies, 'getServiceClientSystemUser').returns(null);
      sinon.stub(ArtifactService.prototype, 'deleteArtifacts').throws('There was an issue deleting an artifact.');
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.body = {
        artifactUUIDs: ['ff84ecfc-046e-4cac-af59-a597047ce63d']
      };
      const requestHandler = path.deleteArtifact();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error: any) {
        expect(error.name).to.be.eql('There was an issue deleting an artifact.');
        expect(dbConnectionObj.release).to.have.been.calledOnce;
        expect(dbConnectionObj.rollback).to.have.been.calledOnce;
      }
    });

    it('responds with proper data', async () => {
      const dbConnectionObj = getMockDBConnection({ rollback: sinon.stub(), release: sinon.stub() });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);
      sinon.stub(path.deleteArtifactDependencies, 'getServiceClientSystemUser').returns(null);
      sinon.stub(ArtifactService.prototype, 'deleteArtifacts').resolves();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.body = {
        artifactUUIDs: ['ff84ecfc-046e-4cac-af59-a597047ce63d']
      };
      const requestHandler = path.deleteArtifact();

      await requestHandler(mockReq, mockRes, mockNext);
      expect(dbConnectionObj.release).to.have.been.calledOnce;
      expect(dbConnectionObj.rollback).to.have.not.been.calledOnce;
    });
  });
});

describe('artifact deletion authorization', () => {
  afterEach(() => sinon.restore());

  for (const roleNames of [[], [SYSTEM_ROLE.SYSTEM_ADMIN], [SYSTEM_ROLE.DATA_ADMINISTRATOR]]) {
    it(`restricts artifact deletion to administrator roles (${roleNames.join(',') || 'ordinary user'})`, async () => {
      sinon.stub(authorizationDependencies, 'getAPIUserDBConnection').returns(getMockDBConnection());
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = { sub: 'user' };
      mockReq.system_user = { system_user_id: 5, role_names: roleNames } as SystemUserExtended;
      let failure: unknown;
      try {
        await (path.POST[0] as RequestHandler)(mockReq, mockRes, mockNext);
      } catch (error_) {
        failure = error_;
      }
      if (roleNames.length) {
        expect(failure).to.be.undefined;
        expect(mockNext).to.have.been.calledOnce;
      } else {
        expect(failure).to.be.instanceOf(HTTP403);
        expect(mockNext).not.to.have.been.called;
      }
    });
  }
});
