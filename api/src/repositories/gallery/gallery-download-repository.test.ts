import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, mockQueryResult } from '../../__mocks__/db';
import { GalleryDownloadRepository } from './gallery-download-repository';

chai.use(sinonChai);

describe('GalleryDownloadRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('addDownloadToGallery', () => {
    it('inserts and binds gallery_id, download_id, and sort', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new GalleryDownloadRepository(mockDBConnection);

      await repo.addDownloadToGallery(10, 'dddd0000-0000-0000-0000-000000000001', 3);

      expect(sqlStub).to.have.been.calledOnce;
      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include('INSERT INTO gallery_download');
      expect(sqlText).to.not.include('ON CONFLICT');
      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include(10);
      expect(sqlValues).to.include('dddd0000-0000-0000-0000-000000000001');
      expect(sqlValues).to.include(3);
    });

    it('binds a null sort', async () => {
      // Verifies: a successful insert (rowCount=1) resolves, and a null sort flows INTO the query

      // Step 1: Setup mock DB to return one inserted row
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new GalleryDownloadRepository(mockDBConnection);

      // Step 3: Call addDownloadToGallery with a null sort
      await repo.addDownloadToGallery(10, 'dddd0000-0000-0000-0000-000000000002', null);

      // Step 4: Verify it did not throw and bound gallery_id, download_id, and the null sort
      expect(sqlStub).to.have.been.calledOnce;
      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include(10);
      expect(sqlValues).to.include('dddd0000-0000-0000-0000-000000000002');
      expect(sqlValues).to.include(null);
    });

    it('throws ApiExecuteSQLError when insert rowCount is not 1', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repo = new GalleryDownloadRepository(mockDBConnection);

      try {
        await repo.addDownloadToGallery(10, 'dddd0000-0000-0000-0000-000000000001', 3);
        expect.fail('expected ApiExecuteSQLError');
      } catch (error: any) {
        expect(error.message).to.equal('Failed to insert gallery download record');
      }
    });
  });

  describe('galleryDownloadExists', () => {
    it('returns true when an active membership exists', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([{ exists: true }], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repo = new GalleryDownloadRepository(mockDBConnection);

      const result = await repo.galleryDownloadExists(10, 'dddd0000-0000-0000-0000-000000000001');

      expect(result).to.be.true;
      expect(sqlStub.firstCall.args[0].text).to.include('SELECT EXISTS');
      expect(sqlStub.firstCall.args[0].values).to.include(10);
      expect(sqlStub.firstCall.args[0].values).to.include('dddd0000-0000-0000-0000-000000000001');
    });

    it('returns false when no active membership exists', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([{ exists: false }], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repo = new GalleryDownloadRepository(mockDBConnection);

      const result = await repo.galleryDownloadExists(10, 'dddd0000-0000-0000-0000-000000000001');

      expect(result).to.be.false;
    });
  });

  describe('removeDownloadFromGallery', () => {
    it('binds gallery_id and download_id and resolves on a no-op (idempotent soft-delete)', async () => {
      // Verifies: the soft-delete binds its coordinates and a zero-row result is a no-op success

      // Step 1: Setup mock DB to return zero rows (already-removed / never-present)
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new GalleryDownloadRepository(mockDBConnection);

      // Step 3: Remove a membership
      await repo.removeDownloadFromGallery(10, 'dddd0000-0000-0000-0000-000000000003');

      // Step 4: Verify it did not throw and bound the coordinates
      expect(sqlStub).to.have.been.calledOnce;
      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include(10);
      expect(sqlValues).to.include('dddd0000-0000-0000-0000-000000000003');
    });
  });

  describe('getGalleryDownloads', () => {
    it('binds the gallery id and returns gallery download records', async () => {
      const rows = [{ download_id: 'a' }, { download_id: 'b' }];
      const knexStub = sinon.stub().resolves(mockQueryResult(rows, rows.length));
      const mockDBConnection = getMockDBConnection({ knex: knexStub });
      const repo = new GalleryDownloadRepository(mockDBConnection);

      const result = await repo.getGalleryDownloads(42);

      expect(result).to.deep.equal(rows);
      expect(knexStub).to.have.been.calledOnce;
      const sqlText = knexStub.firstCall.args[0].toString();
      expect(sqlText).to.include('"gd"."gallery_id" = 42');
    });

    it('uses gallery_download_id as the final deterministic order tie-breaker', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ knex: knexStub });
      const repo = new GalleryDownloadRepository(mockDBConnection);

      await repo.getGalleryDownloads(42);

      const sqlText = knexStub.firstCall.args[0].toString();
      expect(sqlText).to.include('gd.sort ASC NULLS LAST');
      expect(sqlText).to.include('gd.gallery_download_id ASC');
    });

    it('applies pagination and caller-provided sort through the shared repository helper', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([{ download_id: 'a' }], 1));
      const mockDBConnection = getMockDBConnection({ knex: knexStub });
      const repo = new GalleryDownloadRepository(mockDBConnection);

      const result = await repo.getGalleryDownloads(42, { page: 2, limit: 10, sort: 'create_date', order: 'desc' });

      expect(result).to.have.length(1);
      const sqlText = knexStub.firstCall.args[0].toString();
      expect(sqlText).to.include('order by "create_date" desc');
      expect(sqlText).to.include('limit 10');
      expect(sqlText).to.include('offset 10');
    });

    it('returns an empty list when no gallery download records exist', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ knex: knexStub });
      const repo = new GalleryDownloadRepository(mockDBConnection);

      const result = await repo.getGalleryDownloads(42);

      expect(result).to.eql([]);
    });
  });

  describe('getGalleryDownloadsCount', () => {
    it('returns the active gallery download count', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([{ count: 3 }], 1));
      const mockDBConnection = getMockDBConnection({ knex: knexStub });
      const repo = new GalleryDownloadRepository(mockDBConnection);

      const result = await repo.getGalleryDownloadsCount(42);

      expect(result).to.equal(3);
      const sqlText = knexStub.firstCall.args[0].toString();
      expect(sqlText).to.include('"gd"."gallery_id" = 42');
      expect(sqlText).to.match(/exists/i);
      expect(sqlText).to.include('"dv"."record_end_date" is null');
      expect(sqlText).to.include('count(*)');
    });
  });
});
