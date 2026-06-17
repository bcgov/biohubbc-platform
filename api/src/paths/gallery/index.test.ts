import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { createGallery, getGalleries } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../__mocks__/db';
import { createMockGalleryRecord } from '../../__mocks__/gallery';
import * as db from '../../database/db';
import { HTTP400, HTTP409, HTTPError } from '../../errors/http-error';
import { GalleryService } from '../../services/gallery/gallery-service';

chai.use(sinonChai);

describe('paths/gallery/index', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('createGallery', () => {
    it('returns 400 when name is missing', async () => {
      const dbConnectionObj = getMockDBConnection();
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'valid-token';
      mockReq.body = { description: 'no name' };

      const requestHandler = createGallery();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        expect((error as HTTPError).status).to.equal(400);
        expect(error).to.be.instanceOf(HTTP400);
      }
    });

    it('returns 400 when name is empty', async () => {
      const dbConnectionObj = getMockDBConnection();
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'valid-token';
      mockReq.body = { name: '' };

      const requestHandler = createGallery();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        expect((error as HTTPError).status).to.equal(400);
        expect(error).to.be.instanceOf(HTTP400);
      }
    });

    it('returns 400 on unknown body key', async () => {
      const dbConnectionObj = getMockDBConnection();
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'valid-token';
      mockReq.body = { name: 'Valid name', ui_id: 'leaked-from-frontend' };

      const requestHandler = createGallery();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        expect((error as HTTPError).status).to.equal(400);
        expect(error).to.be.instanceOf(HTTP400);
      }
    });

    it('returns 201 with the created record and forwards the parsed body (description omitted)', async () => {
      const commitStub = sinon.stub();
      const dbConnectionObj = getMockDBConnection({ commit: commitStub });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      const created = createMockGalleryRecord({ gallery_id: 7, name: 'My gallery', description: null });
      const createGalleryStub = sinon.stub(GalleryService.prototype, 'createGallery').resolves(created);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'valid-token';
      mockReq.body = { name: 'My gallery' };

      const requestHandler = createGallery();
      await requestHandler(mockReq, mockRes, mockNext);

      // Description omitted in the body — the parsed body is passed straight through; the
      // service coalesces description to null.
      expect(createGalleryStub).to.have.been.calledOnceWith({ name: 'My gallery' });
      expect(commitStub).to.have.been.calledOnce;
      expect(mockRes.statusValue).to.equal(201);
      expect(mockRes.jsonValue).to.eql(created);
    });

    it('rolls back, releases, and propagates 409 when the service throws', async () => {
      const rollbackStub = sinon.stub();
      const releaseStub = sinon.stub();
      const dbConnectionObj = getMockDBConnection({ rollback: rollbackStub, release: releaseStub });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      sinon
        .stub(GalleryService.prototype, 'createGallery')
        .rejects(new HTTP409('A gallery with this name already exists'));

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'valid-token';
      mockReq.body = { name: 'Duplicate' };

      const requestHandler = createGallery();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        expect((error as HTTPError).status).to.equal(409);
        expect(error).to.be.instanceOf(HTTP409);
        expect(rollbackStub).to.have.been.calledOnce;
        expect(releaseStub).to.have.been.calledOnce;
      }
    });
  });

  describe('getGalleries', () => {
    it('returns 200 with the galleries envelope and calls the service once', async () => {
      const dbConnectionObj = getMockDBConnection();
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      const galleries = [createMockGalleryRecord({ gallery_id: 1 }), createMockGalleryRecord({ gallery_id: 2 })];
      const getGalleriesStub = sinon.stub(GalleryService.prototype, 'getGalleries').resolves(galleries);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'valid-token';

      const requestHandler = getGalleries();
      await requestHandler(mockReq, mockRes, mockNext);

      expect(getGalleriesStub).to.have.been.calledOnce;
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql({ galleries });
    });
  });
});
