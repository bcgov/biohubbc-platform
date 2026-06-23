import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, mockQueryResult } from '../../__mocks__/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../../errors/api-error';
import { GalleryRecord } from '../../models/gallery';
import { GalleryRepository } from './gallery-repository';

chai.use(sinonChai);

const galleryRow = (overrides?: Partial<GalleryRecord>): GalleryRecord => ({
  gallery_id: 1,
  name: 'Caribou',
  slug: 'caribou',
  visibility: 'public',
  description: 'Caribou downloads',
  create_date: '2026-01-01T00:00:00.000Z',
  ...overrides
});

describe('GalleryRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('createGallery', () => {
    it('binds name, slug, visibility and description into the INSERT and returns the created row', async () => {
      // Verifies: the payload fields are passed INTO the query (not echoed from the mock)

      // Step 1: Setup mock DB to return a single inserted gallery row
      const row = galleryRow();
      const sqlStub = sinon.stub().resolves(mockQueryResult([row], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new GalleryRepository(mockDBConnection);

      // Step 3: Call createGallery with a real payload
      const result = await repo.createGallery({
        name: 'Caribou',
        slug: 'caribou',
        visibility: 'public',
        description: 'Caribou downloads'
      });

      // Step 4: Verify the returned row
      expect(result).to.deep.equal(row);

      // Step 5: Verify the fields were bound INTO the query, not just echoed
      expect(sqlStub).to.have.been.calledOnce;
      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include('Caribou');
      expect(sqlValues).to.include('caribou');
      expect(sqlValues).to.include('public');
      expect(sqlValues).to.include('Caribou downloads');
    });

    it('binds a null description into the INSERT', async () => {
      // Verifies: a null description flows INTO the query rather than being dropped

      // Step 1: Setup mock DB to return a single inserted gallery row with null description
      const row = galleryRow({ gallery_id: 2, name: 'Moose', slug: 'moose', description: null });
      const sqlStub = sinon.stub().resolves(mockQueryResult([row], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new GalleryRepository(mockDBConnection);

      // Step 3: Call createGallery with a null description
      const result = await repo.createGallery({
        name: 'Moose',
        slug: 'moose',
        visibility: 'public',
        description: null
      });

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
        await repo.createGallery({ name: 'Caribou', slug: 'caribou', visibility: 'public', description: null });
        expect.fail('Expected ApiExecuteSQLError');
      } catch (err: any) {
        // Step 4: Verify the error type and message
        expect(err).to.be.instanceOf(ApiExecuteSQLError);
        expect(err.message).to.equal('Failed to insert gallery record');
      }
    });
  });

  describe('findActiveGalleryBySlug', () => {
    it('binds the slug and returns the row when an active gallery matches', async () => {
      // Verifies: the slug-uniqueness lookup binds the slug and returns the found row

      // Step 1: Setup mock DB to return a single matching row
      const row = galleryRow({ slug: 'home' });
      const sqlStub = sinon.stub().resolves(mockQueryResult([row], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new GalleryRepository(mockDBConnection);

      // Step 3: Look up by slug
      const result = await repo.findActiveGalleryBySlug('home');

      // Step 4: Verify the row is returned and the slug was bound into the query
      expect(result).to.deep.equal(row);
      expect(sqlStub.firstCall.args[0].values).to.include('home');
    });

    it('returns null when no active gallery has the slug', async () => {
      // Verifies: a free slug yields null (find* semantics) rather than throwing

      // Step 1: Setup mock DB to return zero rows
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new GalleryRepository(mockDBConnection);

      // Step 3: Look up a free slug
      const result = await repo.findActiveGalleryBySlug('nope');

      // Step 4: Verify null is returned
      expect(result).to.be.null;
    });
  });

  describe('getGalleryById', () => {
    it('returns the gallery row when found', async () => {
      // Verifies: getGalleryById resolves a found row (via findGalleryById -> connection.sql)

      // Step 1: Setup mock DB to return a single gallery row
      const row = galleryRow({ gallery_id: 7 });
      const sqlStub = sinon.stub().resolves(mockQueryResult([row], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new GalleryRepository(mockDBConnection);

      // Step 3: Call getGalleryById
      const result = await repo.getGalleryById(7);

      // Step 4: Verify the returned row
      expect(result).to.deep.equal(row);
    });

    it('does not constrain visibility for reads', async () => {
      // Verifies: visibility is metadata, not an access-control predicate

      const row = galleryRow({ gallery_id: 7, visibility: 'private' });
      const sqlStub = sinon.stub().resolves(mockQueryResult([row], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new GalleryRepository(mockDBConnection);

      const result = await repo.getGalleryById(7);

      expect(result).to.deep.equal(row);
      expect(sqlStub.firstCall.args[0].text).to.not.match(/visibility = 'public'/);
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
        await repo.updateGallery(123, { name: 'Caribou', slug: 'caribou', visibility: 'public', description: null });
        expect.fail('Expected ApiNotFoundError');
      } catch (err: any) {
        // Step 4: Verify it is ApiNotFoundError, not ApiExecuteSQLError
        expect(err).to.be.instanceOf(ApiNotFoundError);
        expect(err).to.not.be.instanceOf(ApiExecuteSQLError);
        expect(err.message).to.equal('Gallery not found');
      }
    });

    it('binds galleryId and the gallery fields into the UPDATE and returns the updated row', async () => {
      // Verifies: galleryId + name + slug + visibility + description flow INTO the query and the updated row is returned

      // Step 1: Setup mock DB to return the single updated gallery row
      const row = galleryRow({
        gallery_id: 55,
        name: 'Caribou (edited)',
        slug: 'caribou-edited',
        visibility: 'private',
        description: 'Updated description'
      });
      const sqlStub = sinon.stub().resolves(mockQueryResult([row], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new GalleryRepository(mockDBConnection);

      // Step 3: Call updateGallery with an id and new fields
      const result = await repo.updateGallery(55, {
        name: 'Caribou (edited)',
        slug: 'caribou-edited',
        visibility: 'private',
        description: 'Updated description'
      });

      // Step 4: Verify the returned row
      expect(result).to.deep.equal(row);

      // Step 5: Verify the fields were bound into the query
      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include(55);
      expect(sqlValues).to.include('Caribou (edited)');
      expect(sqlValues).to.include('caribou-edited');
      expect(sqlValues).to.include('private');
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
});
