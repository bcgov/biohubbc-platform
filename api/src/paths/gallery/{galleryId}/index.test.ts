import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { deleteGallery, getGalleryById, updateGallery } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import { createMockGalleryRecord } from '../../../__mocks__/gallery';
import * as db from '../../../database/db';
import { ApiNotFoundError } from '../../../errors/api-error';
import { HTTP400, HTTPError } from '../../../errors/http-error';
import { GalleryService } from '../../../services/gallery/gallery-service';

chai.use(sinonChai);

describe('paths/gallery/{galleryId}/index', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getGalleryById', () => {
    it('uses the API-user connection (never the admin getter) and forwards Number(galleryId)', async () => {
      const dbConnectionObj = getMockDBConnection();
      const apiUserStub = sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);
      const dbConnStub = sinon.stub(db.dbDependencies, 'getDBConnection');

      const gallery = createMockGalleryRecord({ gallery_id: 42 });
      const getGalleryByIdStub = sinon.stub(GalleryService.prototype, 'getGalleryById').resolves(gallery);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params = { galleryId: '42' };

      const requestHandler = getGalleryById();
      await requestHandler(mockReq, mockRes, mockNext);

      // Public endpoint: shared API-user connection, never the authenticated getter.
      expect(apiUserStub).to.have.been.calledOnce;
      expect(dbConnStub).to.not.have.been.called;
      // Public endpoint: scoped to public galleries via publicOnly=true.
      expect(getGalleryByIdStub).to.have.been.calledOnceWith(42, true);
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql(gallery);
    });

    it('propagates 404 when the service throws ApiNotFoundError', async () => {
      const dbConnectionObj = getMockDBConnection();
      sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);

      sinon.stub(GalleryService.prototype, 'getGalleryById').rejects(new ApiNotFoundError('Gallery not found'));

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params = { galleryId: '999' };

      const requestHandler = getGalleryById();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }
    });
  });

  describe('updateGallery', () => {
    it('returns 200 and forwards (Number(galleryId), parsed body)', async () => {
      const dbConnectionObj = getMockDBConnection();
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      const updated = createMockGalleryRecord({
        gallery_id: 5,
        name: 'Renamed',
        slug: 'renamed',
        description: 'New desc'
      });
      const updateGalleryStub = sinon.stub(GalleryService.prototype, 'updateGallery').resolves(updated);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'valid-token';
      mockReq.params = { galleryId: '5' };
      mockReq.body = { name: 'Renamed', slug: 'renamed', description: 'New desc' };

      const requestHandler = updateGallery();
      await requestHandler(mockReq, mockRes, mockNext);

      expect(updateGalleryStub).to.have.been.calledOnceWith(5, {
        name: 'Renamed',
        slug: 'renamed',
        description: 'New desc'
      });
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql(updated);
    });

    it('returns 400 on an invalid body', async () => {
      const dbConnectionObj = getMockDBConnection();
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'valid-token';
      mockReq.params = { galleryId: '5' };
      mockReq.body = { name: '' };

      const requestHandler = updateGallery();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        expect((error as HTTPError).status).to.equal(400);
        expect(error).to.be.instanceOf(HTTP400);
      }
    });

    it('propagates 404 when the service throws ApiNotFoundError', async () => {
      const dbConnectionObj = getMockDBConnection();
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      sinon.stub(GalleryService.prototype, 'updateGallery').rejects(new ApiNotFoundError('Gallery not found'));

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'valid-token';
      mockReq.params = { galleryId: '999' };
      mockReq.body = { name: 'Renamed', slug: 'renamed' };

      const requestHandler = updateGallery();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }
    });

    it('rolls back and releases when the service throws', async () => {
      const rollbackStub = sinon.stub();
      const releaseStub = sinon.stub();
      const dbConnectionObj = getMockDBConnection({ rollback: rollbackStub, release: releaseStub });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      sinon.stub(GalleryService.prototype, 'updateGallery').rejects(new ApiNotFoundError('Gallery not found'));

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'valid-token';
      mockReq.params = { galleryId: '999' };
      mockReq.body = { name: 'Renamed', slug: 'renamed' };

      const requestHandler = updateGallery();

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

  describe('deleteGallery', () => {
    it('returns 204 with no body and forwards Number(galleryId)', async () => {
      const dbConnectionObj = getMockDBConnection();
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      const deleteGalleryStub = sinon.stub(GalleryService.prototype, 'deleteGallery').resolves();

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'valid-token';
      mockReq.params = { galleryId: '5' };

      const requestHandler = deleteGallery();
      await requestHandler(mockReq, mockRes, mockNext);

      expect(deleteGalleryStub).to.have.been.calledOnceWith(5);
      expect(mockRes.statusValue).to.equal(204);
      expect(mockRes.jsonValue).to.be.undefined;
    });

    it('rolls back and releases when the service throws', async () => {
      const rollbackStub = sinon.stub();
      const releaseStub = sinon.stub();
      const dbConnectionObj = getMockDBConnection({ rollback: rollbackStub, release: releaseStub });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      sinon.stub(GalleryService.prototype, 'deleteGallery').rejects(new ApiNotFoundError('Gallery not found'));

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'valid-token';
      mockReq.params = { galleryId: '999' };

      const requestHandler = deleteGallery();

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
