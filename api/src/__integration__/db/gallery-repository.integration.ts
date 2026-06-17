// Integration test for GalleryRepository — verifies the curated download gallery
// CRUD + membership SQL against the real database: the partial-unique-index name
// scoping (active-only), soft-delete semantics, idempotent ON CONFLICT membership,
// and the getGalleryDownloads LATERAL join (most-recent active version resolution),
// both-side (gd + download) active filtering, and `sort ASC NULLS LAST, create_date
// ASC` ordering.
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
import { DownloadStatusEnum } from '../../models/download-status';
import { DownloadVersionRepository } from '../../repositories/download/download-version-repository';
import { GalleryRepository } from '../../repositories/gallery/gallery-repository';
import { DownloadPolicyService } from '../../services/download/download-policy-service';
import { DownloadService } from '../../services/download/download-service';

describe('GalleryRepository (integration)', function () {
  this.timeout(15000);

  let connection: IDBConnection;
  let repo: GalleryRepository;
  let policyService: DownloadPolicyService;
  let downloadService: DownloadService;
  let versionRepo: DownloadVersionRepository;

  before(() => {
    initDBPool(defaultPoolConfig);
  });

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    // All seed services + the repo under test share the SAME connection (and thus
    // the same rolled-back transaction), so seeded rows are visible to the repo.
    repo = new GalleryRepository(connection);
    policyService = new DownloadPolicyService(connection);
    downloadService = new DownloadService(connection);
    versionRepo = new DownloadVersionRepository(connection);
  });

  afterEach(async () => {
    await connection.rollback();
    connection.release();
  });

  // ── Helpers ──────────────────────────────────────────────────────────────

  /** Unique gallery name per call — the active-name partial unique index (gallery_nuk1) rejects dupes. */
  function uniqueName(prefix = 'Gallery'): string {
    return `${prefix} ${randomUUID().slice(0, 8)}`;
  }

  /**
   * Seed a fully-readable download: policy → download → active download_version.
   * `download.policy_id` is NOT NULL and a download with no active version is
   * invisible to getGalleryDownloads' INNER JOIN LATERAL, so all three links are
   * required for the member to surface. Mirrors download-service.integration.ts's
   * createPolicyDownload helper, using the same shared connection.
   */
  async function createPolicyDownload(opts?: {
    name?: string;
    description?: string | null;
  }): Promise<{ download_id: string; policy_id: string; download_version_id: string }> {
    const { policy_id } = await policyService.createDownloadPolicy({
      name: opts?.name ?? uniqueName('Policy'),
      description: opts?.description ?? null,
      featureTypes: ['dataset'],
      expressionId: null
    });
    const { download_id } = await downloadService.createDownload({
      policyId: policy_id,
      format: 'parquet',
      requestedBy: connection.systemUserId()
    });
    const version = await versionRepo.createDownloadVersion(download_id);
    return { download_id, policy_id, download_version_id: version.download_version_id };
  }

  /** Count of ACTIVE gallery_download rows for a (gallery, download) pair. */
  async function activeLinkCount(galleryId: number, downloadId: string): Promise<number> {
    const result = await connection.sql(SQL`
      SELECT count(*)::int AS count
      FROM gallery_download
      WHERE gallery_id = ${galleryId} AND download_id = ${downloadId} AND record_end_date IS NULL;
    `);
    return result.rows[0].count;
  }

  // ── createGallery ──────────────────────────────────────────────────────────

  describe('createGallery', () => {
    it('inserts and returns the created gallery record', async () => {
      const name = uniqueName();
      const result = await repo.createGallery({ name, description: 'A described gallery' });

      expect(result.gallery_id).to.be.a('number');
      expect(result.name).to.equal(name);
      expect(result.description).to.equal('A described gallery');
      expect(result.create_date).to.be.a('string');
    });

    it('throws on a duplicate ACTIVE name (gallery_nuk1)', async () => {
      const name = uniqueName();
      await repo.createGallery({ name, description: null });

      try {
        await repo.createGallery({ name, description: null });
        expect.fail('Expected duplicate-name insert to throw');
      } catch (error) {
        // Partial unique index violation surfaces as a SQL error.
        expect(error).to.be.an('error');
      }
    });

    it('allows name reuse after the prior gallery with that name is soft-deleted', async () => {
      const name = uniqueName();
      const first = await repo.createGallery({ name, description: null });

      // Soft-delete frees the name — gallery_nuk1 is scoped to record_end_date IS NULL.
      await repo.deleteGallery(first.gallery_id);

      const second = await repo.createGallery({ name, description: 'reused' });
      expect(second.gallery_id).to.be.a('number');
      expect(second.gallery_id).to.not.equal(first.gallery_id);
      expect(second.name).to.equal(name);
    });
  });

  // ── getGalleries ─────────────────────────────────────────────────────────

  describe('getGalleries', () => {
    it('excludes soft-deleted galleries (active-only)', async () => {
      const active = await repo.createGallery({ name: uniqueName(), description: null });
      const deleted = await repo.createGallery({ name: uniqueName(), description: null });
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
      await repo.createGallery({ name: zName, description: null });
      await repo.createGallery({ name: aName, description: null });

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

  // ── findActiveGalleryByName ──────────────────────────────────────────────

  describe('findActiveGalleryByName', () => {
    it('returns the record for an exact active-name match', async () => {
      const name = uniqueName();
      const created = await repo.createGallery({ name, description: null });

      const found = await repo.findActiveGalleryByName(name);
      expect(found).to.not.be.null;
      expect(found!.gallery_id).to.equal(created.gallery_id);
    });

    it('returns null for a soft-deleted name', async () => {
      const name = uniqueName();
      const created = await repo.createGallery({ name, description: null });
      await repo.deleteGallery(created.gallery_id);

      const found = await repo.findActiveGalleryByName(name);
      expect(found).to.be.null;
    });

    it('returns null when no gallery matches', async () => {
      const found = await repo.findActiveGalleryByName(uniqueName('NoSuch'));
      expect(found).to.be.null;
    });
  });

  // ── findGalleryById / getGalleryById ─────────────────────────────────────

  describe('findGalleryById', () => {
    it('returns the record for an active gallery', async () => {
      const created = await repo.createGallery({ name: uniqueName(), description: null });

      const found = await repo.findGalleryById(created.gallery_id);
      expect(found).to.not.be.null;
      expect(found!.gallery_id).to.equal(created.gallery_id);
    });

    it('returns null for a soft-deleted gallery', async () => {
      const created = await repo.createGallery({ name: uniqueName(), description: null });
      await repo.deleteGallery(created.gallery_id);

      const found = await repo.findGalleryById(created.gallery_id);
      expect(found).to.be.null;
    });

    it('returns null for a missing gallery', async () => {
      const found = await repo.findGalleryById(-1);
      expect(found).to.be.null;
    });
  });

  describe('getGalleryById', () => {
    it('returns the record for an active gallery', async () => {
      const created = await repo.createGallery({ name: uniqueName(), description: null });

      const found = await repo.getGalleryById(created.gallery_id);
      expect(found.gallery_id).to.equal(created.gallery_id);
    });

    it('throws ApiNotFoundError for a soft-deleted gallery', async () => {
      const created = await repo.createGallery({ name: uniqueName(), description: null });
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
  });

  // ── updateGallery ────────────────────────────────────────────────────────

  describe('updateGallery', () => {
    it('returns the updated record for an active gallery', async () => {
      const created = await repo.createGallery({ name: uniqueName(), description: 'before' });
      const newName = uniqueName('Updated');

      const updated = await repo.updateGallery(created.gallery_id, { name: newName, description: 'after' });
      expect(updated.gallery_id).to.equal(created.gallery_id);
      expect(updated.name).to.equal(newName);
      expect(updated.description).to.equal('after');
    });

    it('throws ApiNotFoundError for a soft-deleted gallery', async () => {
      const created = await repo.createGallery({ name: uniqueName(), description: null });
      await repo.deleteGallery(created.gallery_id);

      try {
        await repo.updateGallery(created.gallery_id, { name: uniqueName('Updated'), description: null });
        expect.fail('Expected ApiNotFoundError');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }
    });
  });

  // ── deleteGallery ────────────────────────────────────────────────────────

  describe('deleteGallery', () => {
    it('stamps record_end_date so the gallery is no longer findable', async () => {
      const created = await repo.createGallery({ name: uniqueName(), description: null });

      await repo.deleteGallery(created.gallery_id);

      expect(await repo.findGalleryById(created.gallery_id)).to.be.null;
    });

    it('is a no-op (no error) when called twice', async () => {
      const created = await repo.createGallery({ name: uniqueName(), description: null });

      await repo.deleteGallery(created.gallery_id);
      // Second delete matches no active row — idempotent no-op, must not throw.
      await repo.deleteGallery(created.gallery_id);

      expect(await repo.findGalleryById(created.gallery_id)).to.be.null;
    });
  });

  // ── addDownloadToGallery ─────────────────────────────────────────────────

  describe('addDownloadToGallery', () => {
    it('inserts a fresh active membership row', async () => {
      const gallery = await repo.createGallery({ name: uniqueName(), description: null });
      const { download_id } = await createPolicyDownload();

      await repo.addDownloadToGallery(gallery.gallery_id, download_id, 1);

      expect(await activeLinkCount(gallery.gallery_id, download_id)).to.equal(1);
    });

    it('is a dedupe no-op when re-inserting while the membership is active (ON CONFLICT)', async () => {
      const gallery = await repo.createGallery({ name: uniqueName(), description: null });
      const { download_id } = await createPolicyDownload();

      await repo.addDownloadToGallery(gallery.gallery_id, download_id, 1);
      await repo.addDownloadToGallery(gallery.gallery_id, download_id, 2);

      // Still exactly one active row — the conflict short-circuits the second insert.
      expect(await activeLinkCount(gallery.gallery_id, download_id)).to.equal(1);
    });

    it('inserts a new active row when re-added after removal (partial index ignores the ended row)', async () => {
      const gallery = await repo.createGallery({ name: uniqueName(), description: null });
      const { download_id } = await createPolicyDownload();

      await repo.addDownloadToGallery(gallery.gallery_id, download_id, 1);
      await repo.removeDownloadFromGallery(gallery.gallery_id, download_id);
      // The ended row is invisible to gallery_download_nuk1, so this inserts afresh.
      await repo.addDownloadToGallery(gallery.gallery_id, download_id, 1);

      expect(await activeLinkCount(gallery.gallery_id, download_id)).to.equal(1);

      // And the soft-deleted row is still around as history (total = 2).
      const total = await connection.sql(SQL`
        SELECT count(*)::int AS count
        FROM gallery_download
        WHERE gallery_id = ${gallery.gallery_id} AND download_id = ${download_id};
      `);
      expect(total.rows[0].count).to.equal(2);
    });

    it('persists sort = null', async () => {
      const gallery = await repo.createGallery({ name: uniqueName(), description: null });
      const { download_id } = await createPolicyDownload();

      await repo.addDownloadToGallery(gallery.gallery_id, download_id, null);

      const row = await connection.sql(SQL`
        SELECT sort
        FROM gallery_download
        WHERE gallery_id = ${gallery.gallery_id} AND download_id = ${download_id} AND record_end_date IS NULL;
      `);
      expect(row.rowCount).to.equal(1);
      expect(row.rows[0].sort).to.be.null;
    });
  });

  // ── removeDownloadFromGallery ────────────────────────────────────────────

  describe('removeDownloadFromGallery', () => {
    it('ends an active link so it is excluded from getGalleryDownloads', async () => {
      const gallery = await repo.createGallery({ name: uniqueName(), description: null });
      const { download_id } = await createPolicyDownload();
      await repo.addDownloadToGallery(gallery.gallery_id, download_id, 1);

      await repo.removeDownloadFromGallery(gallery.gallery_id, download_id);

      expect(await activeLinkCount(gallery.gallery_id, download_id)).to.equal(0);
      const members = await repo.getGalleryDownloads(gallery.gallery_id);
      expect(members.map((m) => m.download_id)).to.not.include(download_id);
    });

    it('is a no-op (no error) when the link is already removed', async () => {
      const gallery = await repo.createGallery({ name: uniqueName(), description: null });
      const { download_id } = await createPolicyDownload();
      await repo.addDownloadToGallery(gallery.gallery_id, download_id, 1);

      await repo.removeDownloadFromGallery(gallery.gallery_id, download_id);
      // Second remove matches no active row — idempotent no-op, must not throw.
      await repo.removeDownloadFromGallery(gallery.gallery_id, download_id);

      expect(await activeLinkCount(gallery.gallery_id, download_id)).to.equal(0);
    });
  });

  // ── getGalleryDownloads (the LATERAL-join method just fixed) ──────────────

  describe('getGalleryDownloads', () => {
    it('returns members with joined policy fields and the version-resolved fields from the LATERAL join', async () => {
      const gallery = await repo.createGallery({ name: uniqueName(), description: null });
      const { download_id, download_version_id } = await createPolicyDownload({
        name: 'Curated policy',
        description: 'A curated policy description'
      });
      await repo.addDownloadToGallery(gallery.gallery_id, download_id, 1);

      const members = await repo.getGalleryDownloads(gallery.gallery_id);
      expect(members).to.have.length(1);
      const member = members[0];

      // Joined policy display fields.
      expect(member.name).to.equal('Curated policy');
      expect(member.description).to.equal('A curated policy description');

      // Version-resolved fields carried from the INNER JOIN LATERAL (download_version).
      expect(member.download_id).to.equal(download_id);
      expect(member.download_version_id).to.equal(download_version_id);
      expect(member.download_status).to.equal(DownloadStatusEnum.PENDING);
    });

    it('returns a member with description: null when the policy description is NULL', async () => {
      // download.policy_id is NOT NULL, so the reachable nullable-field case is a
      // policy with a NULL description (LEFT JOIN policy yields description = null).
      const gallery = await repo.createGallery({ name: uniqueName(), description: null });
      const { download_id } = await createPolicyDownload({ name: 'Null-desc policy', description: null });
      await repo.addDownloadToGallery(gallery.gallery_id, download_id, 1);

      const members = await repo.getGalleryDownloads(gallery.gallery_id);
      expect(members).to.have.length(1);
      expect(members[0].name).to.equal('Null-desc policy');
      expect(members[0].description).to.be.null;
    });

    it('excludes a member whose gallery_download link has been ended', async () => {
      const gallery = await repo.createGallery({ name: uniqueName(), description: null });
      const { download_id } = await createPolicyDownload();
      await repo.addDownloadToGallery(gallery.gallery_id, download_id, 1);
      await repo.removeDownloadFromGallery(gallery.gallery_id, download_id);

      const members = await repo.getGalleryDownloads(gallery.gallery_id);
      expect(members).to.eql([]);
    });

    it('excludes a member whose download is soft-deleted even though the link is still active', async () => {
      const gallery = await repo.createGallery({ name: uniqueName(), description: null });
      const { download_id } = await createPolicyDownload();
      await repo.addDownloadToGallery(gallery.gallery_id, download_id, 1);

      // gd link stays active; soft-delete the download itself — the both-side
      // (gd + d) record_end_date IS NULL filter must drop it.
      await connection.sql(SQL`UPDATE download SET record_end_date = now() WHERE download_id = ${download_id};`);

      // Membership link is still active...
      expect(await activeLinkCount(gallery.gallery_id, download_id)).to.equal(1);
      // ...but the soft-deleted download is filtered out.
      const members = await repo.getGalleryDownloads(gallery.gallery_id);
      expect(members.map((m) => m.download_id)).to.not.include(download_id);
    });

    it('orders by sort ASC NULLS LAST then create_date ASC (tiebreaker)', async () => {
      const gallery = await repo.createGallery({ name: uniqueName(), description: null });

      // sort=1, sort=2, sort=null, plus a second sort=1 row at a strictly-later
      // create_date so the create_date ASC tiebreaker (not just sort) is exercised.
      const s1 = await createPolicyDownload({ name: 'sort-1-older' });
      const s2 = await createPolicyDownload({ name: 'sort-2' });
      const sNull = await createPolicyDownload({ name: 'sort-null' });
      const s1b = await createPolicyDownload({ name: 'sort-1-newer' });

      await repo.addDownloadToGallery(gallery.gallery_id, s1.download_id, 1);
      await repo.addDownloadToGallery(gallery.gallery_id, s2.download_id, 2);
      await repo.addDownloadToGallery(gallery.gallery_id, sNull.download_id, null);

      // The second sort=1 row must be strictly NEWER so the create_date ASC tiebreaker
      // is deterministic (both share sort=1; the older one must come first). create_date
      // defaults to the transaction-frozen now(), so all inserts share an identical
      // create_date and the audit trigger makes it immutable on UPDATE (it forces
      // new.create_date = old.create_date). So set the later create_date at INSERT time
      // via raw SQL — the trigger only stamps create_user on INSERT, not create_date.
      await connection.sql(SQL`
        INSERT INTO gallery_download (gallery_id, download_id, sort, create_date)
        VALUES (${gallery.gallery_id}, ${s1b.download_id}, 1, now() + interval '1 second');
      `);

      const orderedIds = (await repo.getGalleryDownloads(gallery.gallery_id)).map((m) => m.download_id);
      expect(orderedIds).to.eql([s1.download_id, s1b.download_id, s2.download_id, sNull.download_id]);
    });

    it('returns [] for an empty gallery', async () => {
      const gallery = await repo.createGallery({ name: uniqueName(), description: null });

      const members = await repo.getGalleryDownloads(gallery.gallery_id);
      expect(members).to.eql([]);
    });
  });
});
