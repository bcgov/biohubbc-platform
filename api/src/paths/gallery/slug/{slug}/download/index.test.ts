import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getPublicGalleryDownloadsBySlug } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../__mocks__/db';
import { createMockGalleryDownloadTileRecord } from '../../../../../__mocks__/gallery-download';
import * as db from '../../../../../database/db';
import { HTTP404 } from '../../../../../errors/http-error';
import { GalleryDownloadTileRecord } from '../../../../../models/gallery-download';
import { GalleryDownloadService } from '../../../../../services/gallery/gallery-download-service';

chai.use(sinonChai);

describe('paths/gallery/slug/{slug}/download/index', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getPublicGalleryDownloadsBySlug', () => {
    it('uses the API-user connection, forwards the raw slug and pagination, and returns downloads with pagination', async () => {
      const dbConnectionObj = getMockDBConnection();
      const apiUserStub = sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);
      const dbConnStub = sinon.stub(db.dbDependencies, 'getDBConnection');

      const tiles: GalleryDownloadTileRecord[] = [createMockGalleryDownloadTileRecord()];
      const getBySlugStub = sinon
        .stub(GalleryDownloadService.prototype, 'getPublicGalleryDownloadsBySlug')
        .resolves({ downloads: tiles, count: 1 });

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params = { slug: 'home' };
      mockReq.query = { page: '2', limit: '10', sort: 'create_date', order: 'desc' };

      const requestHandler = getPublicGalleryDownloadsBySlug();
      await requestHandler(mockReq, mockRes, mockNext);

      // Public endpoint: shared API-user connection, never the authenticated getter.
      expect(apiUserStub).to.have.been.calledOnce;
      expect(dbConnStub).to.not.have.been.called;
      // Slug is forwarded as the raw string — never Number()-coerced like id params.
      // Client sort/order are stripped: the landing order is a product invariant, and
      // the pagination response must not echo a sort the read didn't honor.
      expect(getBySlugStub).to.have.been.calledOnceWith('home', {
        page: 2,
        limit: 10,
        sort: undefined,
        order: undefined
      });
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue.downloads).to.eql(tiles);
      expect(mockRes.jsonValue.pagination).to.eql({
        total: 1,
        per_page: 10,
        current_page: 2,
        last_page: 1,
        sort: undefined,
        order: undefined
      });
      // Tile shape fence: the landing rows carry the stored feature count.
      expect(mockRes.jsonValue.downloads[0]).to.have.property('feature_count');
    });

    it('returns 200 with empty downloads and default pagination when the gallery has no eligible records', async () => {
      const dbConnectionObj = getMockDBConnection();
      sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);

      sinon
        .stub(GalleryDownloadService.prototype, 'getPublicGalleryDownloadsBySlug')
        .resolves({ downloads: [], count: 0 });

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params = { slug: 'home' };

      const requestHandler = getPublicGalleryDownloadsBySlug();
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

    it('propagates 404 when the gallery is private or missing (distinct from the empty-array case)', async () => {
      const dbConnectionObj = getMockDBConnection();
      sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);

      sinon
        .stub(GalleryDownloadService.prototype, 'getPublicGalleryDownloadsBySlug')
        .rejects(new HTTP404('Gallery not found'));

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params = { slug: 'hidden-gallery' };

      const requestHandler = getPublicGalleryDownloadsBySlug();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP404);
      }
    });
  });
});
