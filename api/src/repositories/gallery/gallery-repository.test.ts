import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, mockQueryResult } from '../../__mocks__/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../../errors/api-error';
import { GalleryRecord } from '../../models/gallery';
import { GalleryRepository } from './gallery-repository';

chai.use(sinonChai);

describe('GalleryRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('createGallery', () => {
    it('binds name and description into the INSERT and returns the created row', async () => {
      // Verifies: the payload's name + description are passed INTO the query (not echoed from the mock)

      // Step 1: Setup mock DB to return a single inserted gallery row
      const row: GalleryRecord = {
        gallery_id: 1,
        name: 'Caribou',
        description: 'Caribou downloads',
        create_date: '2026-01-01T00:00:00.000Z'
      };
      const sqlStub = sinon.stub().resolves(mockQueryResult([row], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new GalleryRepository(mockDBConnection);

      // Step 3: Call createGallery with a real name and description
      const result = await repo.createGallery({ name: 'Caribou', description: 'Caribou downloads' });

      // Step 4: Verify the returned row
      expect(result).to.deep.equal(row);

      // Step 5: Verify the name + description were bound INTO the query, not just echoed
      expect(sqlStub).to.have.been.calledOnce;
      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include('Caribou');
      expect(sqlValues).to.include('Caribou downloads');
    });

    it('binds a null description into the INSERT', async () => {
      // Verifies: a null description flows INTO the query rather than being dropped

      // Step 1: Setup mock DB to return a single inserted gallery row with null description
      const row: GalleryRecord = {
        gallery_id: 2,
        name: 'Moose',
        description: null,
        create_date: '2026-01-01T00:00:00.000Z'
      };
      const sqlStub = sinon.stub().resolves(mockQueryResult([row], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new GalleryRepository(mockDBConnection);

      // Step 3: Call createGallery with a null description
      const result = await repo.createGallery({ name: 'Moose', description: null });

      // Step 4: Verify the returned row
      expect(result).to.deep.equal(row);

      // Step 5: Verify name and the explicit null description were bound into the query
      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include('Moose');
      expect(sqlValues).to.include(null);
    });

    it('throws ApiExecuteSQLError when rowCount is not 1', async () => {
      // Verifies: the INSERT rowCount guard throws ApiExecuteSQLError on an unexpected 0-row result

      // Step 1: Setup mock DB to return zero rows
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new GalleryRepository(mockDBConnection);

      // Step 3: Call createGallery and expect it to throw
      try {
        await repo.createGallery({ name: 'Caribou', description: null });
        expect.fail('Expected ApiExecuteSQLError');
      } catch (err: any) {
        // Step 4: Verify the error type and message
        expect(err).to.be.instanceOf(ApiExecuteSQLError);
        expect(err.message).to.equal('Failed to insert gallery record');
      }
    });
  });

  describe('getGalleryById', () => {
    it('returns the gallery row when found', async () => {
      // Verifies: getGalleryById resolves a found row (via findGalleryById -> connection.sql)

      // Step 1: Setup mock DB to return a single gallery row
      const row: GalleryRecord = {
        gallery_id: 7,
        name: 'Caribou',
        description: 'Caribou downloads',
        create_date: '2026-01-01T00:00:00.000Z'
      };
      const sqlStub = sinon.stub().resolves(mockQueryResult([row], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new GalleryRepository(mockDBConnection);

      // Step 3: Call getGalleryById
      const result = await repo.getGalleryById(7);

      // Step 4: Verify the returned row
      expect(result).to.deep.equal(row);
    });

    it('throws ApiNotFoundError when no row is returned', async () => {
      // Verifies: getGalleryById throws ApiNotFoundError when findGalleryById yields no active row.
      // We stub connection.sql (not findGalleryById) so the get->find delegation runs for real.

      // Step 1: Setup mock DB to return zero rows
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new GalleryRepository(mockDBConnection);

      // Step 3: Call getGalleryById and expect it to throw
      try {
        await repo.getGalleryById(999);
        expect.fail('Expected ApiNotFoundError');
      } catch (err: any) {
        // Step 4: Verify the error type and message
        expect(err).to.be.instanceOf(ApiNotFoundError);
        expect(err.message).to.equal('Gallery not found');
      }
    });
  });

  describe('updateGallery', () => {
    it('throws ApiNotFoundError when rowCount is not 1', async () => {
      // Verifies: the UPDATE zero-row result is a 404 (ApiNotFoundError), NOT a 500
      // (ApiExecuteSQLError) — the deliberate error-type contrast vs createGallery.

      // Step 1: Setup mock DB to return zero rows
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new GalleryRepository(mockDBConnection);

      // Step 3: Call updateGallery and expect it to throw
      try {
        await repo.updateGallery(123, { name: 'Caribou', description: null });
        expect.fail('Expected ApiNotFoundError');
      } catch (err: any) {
        // Step 4: Verify it is ApiNotFoundError, not ApiExecuteSQLError
        expect(err).to.be.instanceOf(ApiNotFoundError);
        expect(err).to.not.be.instanceOf(ApiExecuteSQLError);
        expect(err.message).to.equal('Gallery not found');
      }
    });

    it('binds galleryId, name, and description into the UPDATE and returns the updated row', async () => {
      // Verifies: galleryId + name + description flow INTO the query and the updated row is returned

      // Step 1: Setup mock DB to return the single updated gallery row
      const row: GalleryRecord = {
        gallery_id: 55,
        name: 'Caribou (edited)',
        description: 'Updated description',
        create_date: '2026-01-01T00:00:00.000Z'
      };
      const sqlStub = sinon.stub().resolves(mockQueryResult([row], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new GalleryRepository(mockDBConnection);

      // Step 3: Call updateGallery with an id and a new name/description
      const result = await repo.updateGallery(55, { name: 'Caribou (edited)', description: 'Updated description' });

      // Step 4: Verify the returned row
      expect(result).to.deep.equal(row);

      // Step 5: Verify galleryId, name, and description were bound into the query
      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include(55);
      expect(sqlValues).to.include('Caribou (edited)');
      expect(sqlValues).to.include('Updated description');
    });
  });

  describe('deleteGallery', () => {
    it('resolves without throwing when no row is updated (idempotent no-op)', async () => {
      // Verifies: soft-delete is idempotent — a zero-row result is a no-op success, not an error

      // Step 1: Setup mock DB to return zero rows (already-deleted / never-existed)
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new GalleryRepository(mockDBConnection);

      // Step 3: Call deleteGallery and verify it resolves (does not throw)
      await repo.deleteGallery(404);

      // Step 4: Verify the delete SQL was issued
      expect(sqlStub).to.have.been.calledOnce;
    });
  });

  describe('addDownloadToGallery', () => {
    it('does not throw on conflict (rowCount 0) and binds gallery_id, download_id, and sort', async () => {
      // Verifies: a conflict (rowCount=0) is a valid no-op, and the three values flow INTO the query

      // Step 1: Setup mock DB to return zero rows (ON CONFLICT DO NOTHING)
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new GalleryRepository(mockDBConnection);

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
      const repo = new GalleryRepository(mockDBConnection);

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
});
