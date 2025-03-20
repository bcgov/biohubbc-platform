import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../database/db';
import { ArtifactService } from '../../services/artifact-service';
import * as keycloakUtils from '../../utils/keycloak-utils';
import { getMockDBConnection, getRequestHandlerMocks } from '../../__mocks__/db';
import { deleteArtifact } from './delete';

chai.use(sinonChai);

describe('delete artifact', () => {
  describe('deleteArtifact', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('catches and throws error', async () => {
      const dbConnectionObj = getMockDBConnection({ rollback: sinon.stub(), release: sinon.stub() });
      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);
      sinon.stub(keycloakUtils, 'getServiceClientSystemUser').returns(null);
      sinon.stub(ArtifactService.prototype, 'deleteArtifacts').throws('There was an issue deleting an artifact.');
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.body = {
        artifactUUIDs: ['ff84ecfc-046e-4cac-af59-a597047ce63d']
      };
      const requestHandler = deleteArtifact();

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
      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);
      sinon.stub(keycloakUtils, 'getServiceClientSystemUser').returns(null);
      sinon.stub(ArtifactService.prototype, 'deleteArtifacts').resolves();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.body = {
        artifactUUIDs: ['ff84ecfc-046e-4cac-af59-a597047ce63d']
      };
      const requestHandler = deleteArtifact();

      await requestHandler(mockReq, mockRes, mockNext);
      expect(dbConnectionObj.release).to.have.been.calledOnce;
      expect(dbConnectionObj.rollback).to.have.not.been.calledOnce;
    });
  });
});
