// Integration test for GalleryRepository — verifies the curated download gallery
// CRUD SQL against the real database: the partial-unique-index slug scoping
// (active-only), the public visibility filter, and soft-delete semantics.
//
// The gallery↔download membership SQL is covered by
// gallery-download-repository.integration.ts.
//
// Uses a transaction that is ROLLED BACK after each test, so no data is persisted.
//
// Run: make test-db
// Requires: make web (database must be running with seed data)

import { expect } from 'chai';
import { describe } from 'mocha';
import { randomUUID } from 'node:crypto';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { ApiNotFoundError } from '../../errors/api-error';
import { GalleryRecord, GalleryVisibility } from '../../models/gallery';
import { GalleryRepository } from '../../repositories/gallery/gallery-repository';

/** Unique gallery name per call. */
function uniqueName(prefix = 'Gallery'): string {
  return `${prefix} ${randomUUID().slice(0, 8)}`;
}

/** Unique gallery slug per call — the active-slug partial unique index (gallery_nuk1) rejects dupes. */
function uniqueSlug(prefix = 'gallery'): string {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

describe('GalleryRepository (integration)', function () {
  this.timeout(15000);

  let connection: IDBConnection;
  let repo: GalleryRepository;

  before(() => {
    initDBPool(defaultPoolConfig);
  });

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    repo = new GalleryRepository(connection);
  });

  afterEach(async () => {
    await connection.rollback();
    connection.release();
  });

  // ── Helpers ──────────────────────────────────────────────────────────────

  /** Create an active gallery with sensible unique defaults; callers override what matters. */
  function seedGallery(
    overrides?: Partial<{ name: string; slug: string; visibility: GalleryVisibility; description: string | null }>
  ): Promise<GalleryRecord> {
    return repo.createGallery({
      name: overrides?.name ?? uniqueName(),
      slug: overrides?.slug ?? uniqueSlug(),
      visibility: overrides?.visibility ?? 'public',
      description: overrides?.description ?? null
    });
  }

  // ── createGallery ──────────────────────────────────────────────────────────

  describe('createGallery', () => {
    it('inserts and returns the created gallery record', async () => {
      const name = uniqueName();
      const slug = uniqueSlug();
      const result = await repo.createGallery({ name, slug, visibility: 'public', description: 'A described gallery' });

      expect(result.gallery_id).to.be.a('number');
      expect(result.name).to.equal(name);
      expect(result.slug).to.equal(slug);
      expect(result.visibility).to.equal('public');
      expect(result.description).to.equal('A described gallery');
      expect(result.create_date).to.be.a('string');
    });

    it('persists a private visibility', async () => {
      const result = await seedGallery({ visibility: 'private' });
      expect(result.visibility).to.equal('private');
    });

    it('throws on a duplicate ACTIVE slug (gallery_nuk1)', async () => {
      const slug = uniqueSlug();
      await seedGallery({ slug });

      try {
        await seedGallery({ slug });
        expect.fail('Expected duplicate-slug insert to throw');
      } catch (error) {
        // Partial unique index violation surfaces as a SQL error. The clean 409 is
        // applied above this layer by the service pre-check (see gallery-service).
        expect(error).to.be.an('error');
      }
    });

    it('allows a duplicate display NAME (only slug is unique)', async () => {
      const name = uniqueName('Shared');
      const first = await seedGallery({ name });
      // Same name, different slug — must succeed since name is no longer unique.
      const second = await seedGallery({ name });

      expect(second.gallery_id).to.not.equal(first.gallery_id);
      expect(second.name).to.equal(name);
    });

    it('allows slug reuse after the prior gallery with that slug is soft-deleted', async () => {
      const slug = uniqueSlug();
      const first = await seedGallery({ slug });

      // Soft-delete frees the slug — gallery_nuk1 is scoped to record_end_date IS NULL.
      await repo.deleteGallery(first.gallery_id);

      const second = await seedGallery({ slug });
      expect(second.gallery_id).to.be.a('number');
      expect(second.gallery_id).to.not.equal(first.gallery_id);
      expect(second.slug).to.equal(slug);
    });
  });

  // ── getGalleries ─────────────────────────────────────────────────────────

  describe('getGalleries', () => {
    it('excludes soft-deleted galleries (active-only)', async () => {
      const active = await seedGallery();
      const deleted = await seedGallery();
      await repo.deleteGallery(deleted.gallery_id);

      const ids = (await repo.getGalleries()).map((g) => g.gallery_id);
      expect(ids).to.include(active.gallery_id);
      expect(ids).to.not.include(deleted.gallery_id);
    });

    it('orders by name ASC', async () => {
      // Deliberately reversed alphabetical names with a shared unique suffix so the
      // ASC ordering between just these two is unambiguous regardless of seed data.
      const suffix = randomUUID().slice(0, 8);
      const zName = `ZZZ ${suffix}`;
      const aName = `AAA ${suffix}`;
      await seedGallery({ name: zName });
      await seedGallery({ name: aName });

      const names = (await repo.getGalleries()).map((g) => g.name);
      expect(names.indexOf(aName)).to.be.lessThan(names.indexOf(zName));
    });

    it('returns [] when there are no active galleries', async () => {
      // Soft-delete every currently-active gallery, then expect an empty list.
      await connection.sql(SQL`UPDATE gallery SET record_end_date = now() WHERE record_end_date IS NULL;`);

      const result = await repo.getGalleries();
      expect(result).to.eql([]);
    });
  });

  // ── findActiveGalleryBySlug ──────────────────────────────────────────────

  describe('findActiveGalleryBySlug', () => {
    it('returns the record for an exact active-slug match', async () => {
      const slug = uniqueSlug();
      const created = await seedGallery({ slug });

      const found = await repo.findActiveGalleryBySlug(slug);
      expect(found).to.not.be.null;
      expect(found!.gallery_id).to.equal(created.gallery_id);
    });

    it('returns null for a soft-deleted slug', async () => {
      const slug = uniqueSlug();
      const created = await seedGallery({ slug });
      await repo.deleteGallery(created.gallery_id);

      const found = await repo.findActiveGalleryBySlug(slug);
      expect(found).to.be.null;
    });

    it('returns null when no gallery matches', async () => {
      const found = await repo.findActiveGalleryBySlug(uniqueSlug('nosuch'));
      expect(found).to.be.null;
    });
  });

  // ── findGalleryById / getGalleryById ─────────────────────────────────────

  describe('findGalleryById', () => {
    it('returns the record for an active gallery', async () => {
      const created = await seedGallery();

      const found = await repo.findGalleryById(created.gallery_id);
      expect(found).to.not.be.null;
      expect(found!.gallery_id).to.equal(created.gallery_id);
    });

    it('returns null for a soft-deleted gallery', async () => {
      const created = await seedGallery();
      await repo.deleteGallery(created.gallery_id);

      const found = await repo.findGalleryById(created.gallery_id);
      expect(found).to.be.null;
    });

    it('returns null for a missing gallery', async () => {
      const found = await repo.findGalleryById(-1);
      expect(found).to.be.null;
    });

    it('returns a private gallery when publicOnly is not set', async () => {
      const created = await seedGallery({ visibility: 'private' });

      const found = await repo.findGalleryById(created.gallery_id);
      expect(found).to.not.be.null;
      expect(found!.visibility).to.equal('private');
    });

    it('hides a private gallery when publicOnly is true', async () => {
      const created = await seedGallery({ visibility: 'private' });

      const found = await repo.findGalleryById(created.gallery_id, true);
      expect(found).to.be.null;
    });

    it('returns a public gallery when publicOnly is true', async () => {
      const created = await seedGallery({ visibility: 'public' });

      const found = await repo.findGalleryById(created.gallery_id, true);
      expect(found).to.not.be.null;
      expect(found!.gallery_id).to.equal(created.gallery_id);
    });
  });

  describe('getGalleryById', () => {
    it('returns the record for an active gallery', async () => {
      const created = await seedGallery();

      const found = await repo.getGalleryById(created.gallery_id);
      expect(found.gallery_id).to.equal(created.gallery_id);
    });

    it('throws ApiNotFoundError for a soft-deleted gallery', async () => {
      const created = await seedGallery();
      await repo.deleteGallery(created.gallery_id);

      try {
        await repo.getGalleryById(created.gallery_id);
        expect.fail('Expected ApiNotFoundError');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }
    });

    it('throws ApiNotFoundError for a missing gallery', async () => {
      try {
        await repo.getGalleryById(-1);
        expect.fail('Expected ApiNotFoundError');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }
    });

    it('throws ApiNotFoundError for a private gallery when publicOnly is true', async () => {
      const created = await seedGallery({ visibility: 'private' });

      try {
        await repo.getGalleryById(created.gallery_id, true);
        expect.fail('Expected ApiNotFoundError');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }
    });
  });

  // ── updateGallery ────────────────────────────────────────────────────────

  describe('updateGallery', () => {
    it('returns the updated record for an active gallery', async () => {
      const created = await seedGallery({ description: 'before' });
      const newName = uniqueName('Updated');
      const newSlug = uniqueSlug('updated');

      const updated = await repo.updateGallery(created.gallery_id, {
        name: newName,
        slug: newSlug,
        visibility: 'private',
        description: 'after'
      });
      expect(updated.gallery_id).to.equal(created.gallery_id);
      expect(updated.name).to.equal(newName);
      expect(updated.slug).to.equal(newSlug);
      expect(updated.visibility).to.equal('private');
      expect(updated.description).to.equal('after');
    });

    it('throws ApiNotFoundError for a soft-deleted gallery', async () => {
      const created = await seedGallery();
      await repo.deleteGallery(created.gallery_id);

      try {
        await repo.updateGallery(created.gallery_id, {
          name: uniqueName('Updated'),
          slug: uniqueSlug('updated'),
          visibility: 'public',
          description: null
        });
        expect.fail('Expected ApiNotFoundError');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }
    });

    it('allows a no-op update to the gallery’s own current slug', async () => {
      // A self-update must not trip the unique index against the row's own value.
      const created = await seedGallery({ description: 'before' });

      const updated = await repo.updateGallery(created.gallery_id, {
        name: created.name,
        slug: created.slug,
        visibility: created.visibility,
        description: 'after'
      });
      expect(updated.gallery_id).to.equal(created.gallery_id);
      expect(updated.slug).to.equal(created.slug);
      expect(updated.description).to.equal('after');
    });
  });

  // ── deleteGallery ────────────────────────────────────────────────────────

  describe('deleteGallery', () => {
    it('stamps record_end_date so the gallery is no longer findable', async () => {
      const created = await seedGallery();

      await repo.deleteGallery(created.gallery_id);

      expect(await repo.findGalleryById(created.gallery_id)).to.be.null;
    });

    it('is a no-op (no error) when called twice', async () => {
      const created = await seedGallery();

      await repo.deleteGallery(created.gallery_id);
      // Second delete matches no active row — idempotent no-op, must not throw.
      await repo.deleteGallery(created.gallery_id);

      expect(await repo.findGalleryById(created.gallery_id)).to.be.null;
    });
  });
});
