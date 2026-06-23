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
    it('does not throw on conflict (rowCount 0) and binds gallery_id, download_id, and sort', async () => {
      // Verifies: a conflict (rowCount=0) is a valid no-op, and the three values flow INTO the query

      // Step 1: Setup mock DB to return zero rows (ON CONFLICT DO NOTHING)
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new GalleryDownloadRepository(mockDBConnection);

      // Step 3: Call addDownloadToGallery with a real numeric sort
      await repo.addDownloadToGallery(10, 'dddd0000-0000-0000-0000-000000000001', 3);

      // Step 4: Verify it did not throw and bound all three values
      expect(sqlStub).to.have.been.calledOnce;
      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include(10);
      expect(sqlValues).to.include('dddd0000-0000-0000-0000-000000000001');
      expect(sqlValues).to.include(3);
    });

    it('does not throw on insert (rowCount 1) and binds a null sort', async () => {
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
    it('binds the gallery id and returns the member rows', async () => {
      // Verifies: the membership read binds the gallery id and returns the flat rows

      // Step 1: Setup mock DB to return member rows
      const rows = [{ download_id: 'a' }, { download_id: 'b' }];
      const sqlStub = sinon.stub().resolves(mockQueryResult(rows, rows.length));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new GalleryDownloadRepository(mockDBConnection);

      // Step 3: Read a gallery's members
      const result = await repo.getGalleryDownloads(42);

      // Step 4: Verify the rows are returned and the gallery id was bound
      expect(result).to.deep.equal(rows);
      expect(sqlStub.firstCall.args[0].values).to.include(42);
    });
  });
});
