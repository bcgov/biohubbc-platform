import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { addDownloadToGallery, getGalleryDownloads } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import { createMockDownloadRecord } from '../../../../__mocks__/download';
import * as db from '../../../../database/db';
import { ApiNotFoundError } from '../../../../errors/api-error';
import { DownloadDetailRecord } from '../../../../models/download';
import { GalleryDownloadService } from '../../../../services/gallery/gallery-download-service';

chai.use(sinonChai);

describe('paths/gallery/{galleryId}/download/index', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getGalleryDownloads', () => {
    it('uses the API-user connection, forwards Number(galleryId) and pagination, and returns downloads with pagination', async () => {
      const dbConnectionObj = getMockDBConnection();
      const apiUserStub = sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);
      const dbConnStub = sinon.stub(db.dbDependencies, 'getDBConnection');

      const members: DownloadDetailRecord[] = [createMockDownloadRecord()];
      const getGalleryDownloadsStub = sinon
        .stub(GalleryDownloadService.prototype, 'getGalleryDownloads')
        .resolves({ downloads: members, count: 1 });

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params = { galleryId: '42' };
      mockReq.query = { page: '2', limit: '10', sort: 'create_date', order: 'desc' };

      const requestHandler = getGalleryDownloads();
      await requestHandler(mockReq, mockRes, mockNext);

      // Public endpoint: shared API-user connection, never the authenticated getter.
      expect(apiUserStub).to.have.been.calledOnce;
      expect(dbConnStub).to.not.have.been.called;
      expect(getGalleryDownloadsStub).to.have.been.calledOnceWith(42, {
        page: 2,
        limit: 10,
        sort: 'create_date',
        order: 'desc'
      });
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue.downloads).to.eql(members);
      expect(mockRes.jsonValue.pagination).to.eql({
        total: 1,
        per_page: 10,
        current_page: 2,
        last_page: 1,
        sort: 'create_date',
        order: 'desc'
      });
      expect(mockRes.jsonValue.downloads[0]).to.not.have.property('exports');
    });

    it('returns 200 with empty downloads and default pagination when the gallery has no download records', async () => {
      const dbConnectionObj = getMockDBConnection();
      sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);

      sinon.stub(GalleryDownloadService.prototype, 'getGalleryDownloads').resolves({ downloads: [], count: 0 });

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params = { galleryId: '42' };

      const requestHandler = getGalleryDownloads();
      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql({
        downloads: [],
        pagination: {
          total: 0,
          per_page: 25,
          current_page: 1,
          last_page: 1,
          sort: undefined,
          order: undefined
        }
      });
    });

    it('propagates 404 when the gallery is missing (distinct from the empty-array case)', async () => {
      const dbConnectionObj = getMockDBConnection();
      sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);

      sinon
        .stub(GalleryDownloadService.prototype, 'getGalleryDownloads')
        .rejects(new ApiNotFoundError('Gallery not found'));

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params = { galleryId: '999' };

      const requestHandler = getGalleryDownloads();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }
    });
  });

  describe('addDownloadToGallery', () => {
    it('returns 201 and forwards (Number(galleryId), downloadId, null) when sort is omitted', async () => {
      const dbConnectionObj = getMockDBConnection();
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      const addStub = sinon.stub(GalleryDownloadService.prototype, 'addDownloadToGallery').resolves();

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'valid-token';
      mockReq.params = { galleryId: '5' };
      mockReq.body = { downloadId: 'aaaa0000-0000-0000-0000-000000000042' };

      const requestHandler = addDownloadToGallery();
      await requestHandler(mockReq, mockRes, mockNext);

      // sort omitted → coalesced to null at the boundary.
      expect(addStub).to.have.been.calledOnceWith(5, 'aaaa0000-0000-0000-0000-000000000042', null);
      expect(mockRes.statusValue).to.equal(201);
    });

    it('forwards the explicit sort value when provided', async () => {
      const dbConnectionObj = getMockDBConnection();
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      const addStub = sinon.stub(GalleryDownloadService.prototype, 'addDownloadToGallery').resolves();

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'valid-token';
      mockReq.params = { galleryId: '5' };
      mockReq.body = { downloadId: 'aaaa0000-0000-0000-0000-000000000042', sort: 3 };

      const requestHandler = addDownloadToGallery();
      await requestHandler(mockReq, mockRes, mockNext);

      expect(addStub).to.have.been.calledOnceWith(5, 'aaaa0000-0000-0000-0000-000000000042', 3);
      expect(mockRes.statusValue).to.equal(201);
    });

    it('rolls back, releases, and propagates 404 when the service throws (non-existent download)', async () => {
      const rollbackStub = sinon.stub();
      const releaseStub = sinon.stub();
      const dbConnectionObj = getMockDBConnection({ rollback: rollbackStub, release: releaseStub });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      // The service now defers to getDownloadById, which throws ApiNotFoundError (404)
      // for a missing download rather than a hand-rolled 400.
      sinon
        .stub(GalleryDownloadService.prototype, 'addDownloadToGallery')
        .rejects(new ApiNotFoundError('Download not found'));

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'valid-token';
      mockReq.params = { galleryId: '5' };
      mockReq.body = { downloadId: 'aaaa0000-0000-0000-0000-000000000042' };

      const requestHandler = addDownloadToGallery();

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
