import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { removeDownloadFromGallery } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../__mocks__/db';
import * as db from '../../../../../database/db';
import { ApiNotFoundError } from '../../../../../errors/api-error';
import { GalleryService } from '../../../../../services/gallery/gallery-service';

chai.use(sinonChai);

describe('paths/gallery/{galleryId}/download/{downloadId}/index', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('removeDownloadFromGallery', () => {
    it('returns 204 with no body and forwards (Number(galleryId), downloadId string)', async () => {
      const dbConnectionObj = getMockDBConnection();
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      const removeStub = sinon.stub(GalleryService.prototype, 'removeDownloadFromGallery').resolves();

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'valid-token';
      mockReq.params = { galleryId: '5', downloadId: 'aaaa0000-0000-0000-0000-000000000042' };

      const requestHandler = removeDownloadFromGallery();
      await requestHandler(mockReq, mockRes, mockNext);

      expect(removeStub).to.have.been.calledOnceWith(5, 'aaaa0000-0000-0000-0000-000000000042');
      expect(mockRes.statusValue).to.equal(204);
      expect(mockRes.jsonValue).to.be.undefined;
    });

    it('rolls back and releases when the service throws', async () => {
      const rollbackStub = sinon.stub();
      const releaseStub = sinon.stub();
      const dbConnectionObj = getMockDBConnection({ rollback: rollbackStub, release: releaseStub });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      sinon
        .stub(GalleryService.prototype, 'removeDownloadFromGallery')
        .rejects(new ApiNotFoundError('Gallery not found'));

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'valid-token';
      mockReq.params = { galleryId: '999', downloadId: 'aaaa0000-0000-0000-0000-000000000042' };

      const requestHandler = removeDownloadFromGallery();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
        expect(rollbackStub).to.have.been.calledOnce;
        expect(releaseStub).to.have.been.calledOnce;
      }
    });
  });
});
