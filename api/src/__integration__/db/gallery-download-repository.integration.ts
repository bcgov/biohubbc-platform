// Integration test for GalleryDownloadRepository — verifies the gallery↔download
// membership SQL against the real database: duplicate detection,
// soft-delete semantics, and the getGalleryDownloads LATERAL join (most-recent
// active version resolution), both-side (gd + download) active filtering, and
// deterministic membership ordering.
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
import { DownloadStatusEnum } from '../../models/download-status';
import { GalleryRecord } from '../../models/gallery';
import { DownloadVersionRepository } from '../../repositories/download/download-version-repository';
import { GalleryDownloadRepository } from '../../repositories/gallery/gallery-download-repository';
import { GalleryRepository } from '../../repositories/gallery/gallery-repository';
import { DownloadPolicyService } from '../../services/download/download-policy-service';
import { DownloadService } from '../../services/download/download-service';

function unique(prefix: string): string {
  return `${prefix} ${randomUUID().slice(0, 8)}`;
}

describe('GalleryDownloadRepository (integration)', function () {
  this.timeout(15000);

  let connection: IDBConnection;
  let repo: GalleryDownloadRepository;
  let galleryRepo: GalleryRepository;
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
    repo = new GalleryDownloadRepository(connection);
    galleryRepo = new GalleryRepository(connection);
    policyService = new DownloadPolicyService(connection);
    downloadService = new DownloadService(connection);
    versionRepo = new DownloadVersionRepository(connection);
  });

  afterEach(async () => {
    await connection.rollback();
    connection.release();
  });

  // ── Helpers ──────────────────────────────────────────────────────────────

  /** Create an active gallery with unique name + slug. */
  function seedGallery(): Promise<GalleryRecord> {
    const suffix = randomUUID().slice(0, 8);
    return galleryRepo.createGallery({
      name: `Gallery ${suffix}`,
      slug: `gallery-${suffix}`,
      visibility: 'public',
      description: null
    });
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
      name: opts?.name ?? unique('Policy'),
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

  // ── addDownloadToGallery ─────────────────────────────────────────────────

  describe('addDownloadToGallery', () => {
    it('inserts a fresh active membership row', async () => {
      const gallery = await seedGallery();
      const { download_id } = await createPolicyDownload();

      await repo.addDownloadToGallery(gallery.gallery_id, download_id, 1);

      expect(await activeLinkCount(gallery.gallery_id, download_id)).to.equal(1);
    });

    it('throws when inserting a duplicate active membership', async () => {
      const gallery = await seedGallery();
      const { download_id } = await createPolicyDownload();

      await repo.addDownloadToGallery(gallery.gallery_id, download_id, 1);
      expect(await activeLinkCount(gallery.gallery_id, download_id)).to.equal(1);

      try {
        await repo.addDownloadToGallery(gallery.gallery_id, download_id, 2);
        expect.fail('Expected duplicate active membership insert to throw');
      } catch (error) {
        expect(error).to.be.an('error');
      }
    });

    it('inserts a new active row when re-added after removal (partial index ignores the ended row)', async () => {
      const gallery = await seedGallery();
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
      const gallery = await seedGallery();
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

  // ── galleryDownloadExists ────────────────────────────────────────────────

  describe('galleryDownloadExists', () => {
    it('returns true for an active membership', async () => {
      const gallery = await seedGallery();
      const { download_id } = await createPolicyDownload();
      await repo.addDownloadToGallery(gallery.gallery_id, download_id, 1);

      expect(await repo.galleryDownloadExists(gallery.gallery_id, download_id)).to.equal(true);
    });

    it('returns false for a missing or ended membership', async () => {
      const gallery = await seedGallery();
      const { download_id } = await createPolicyDownload();

      expect(await repo.galleryDownloadExists(gallery.gallery_id, download_id)).to.equal(false);

      await repo.addDownloadToGallery(gallery.gallery_id, download_id, 1);
      await repo.removeDownloadFromGallery(gallery.gallery_id, download_id);

      expect(await repo.galleryDownloadExists(gallery.gallery_id, download_id)).to.equal(false);
    });
  });

  // ── removeDownloadFromGallery ────────────────────────────────────────────

  describe('removeDownloadFromGallery', () => {
    it('ends an active link so it is excluded from getGalleryDownloads', async () => {
      const gallery = await seedGallery();
      const { download_id } = await createPolicyDownload();
      await repo.addDownloadToGallery(gallery.gallery_id, download_id, 1);

      await repo.removeDownloadFromGallery(gallery.gallery_id, download_id);

      expect(await activeLinkCount(gallery.gallery_id, download_id)).to.equal(0);
      const members = await repo.getGalleryDownloads(gallery.gallery_id);
      expect(members.map((m) => m.download_id)).to.not.include(download_id);
    });

    it('is a no-op (no error) when the link is already removed', async () => {
      const gallery = await seedGallery();
      const { download_id } = await createPolicyDownload();
      await repo.addDownloadToGallery(gallery.gallery_id, download_id, 1);

      await repo.removeDownloadFromGallery(gallery.gallery_id, download_id);
      // Second remove matches no active row — idempotent no-op, must not throw.
      await repo.removeDownloadFromGallery(gallery.gallery_id, download_id);

      expect(await activeLinkCount(gallery.gallery_id, download_id)).to.equal(0);
    });
  });

  // ── getGalleryDownloads (the LATERAL-join method) ────────────────────────

  describe('getGalleryDownloads', () => {
    it('returns gallery download records with joined policy fields and the version-resolved fields from the LATERAL join', async () => {
      const gallery = await seedGallery();
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
      const gallery = await seedGallery();
      const { download_id } = await createPolicyDownload({ name: 'Null-desc policy', description: null });
      await repo.addDownloadToGallery(gallery.gallery_id, download_id, 1);

      const members = await repo.getGalleryDownloads(gallery.gallery_id);
      expect(members).to.have.length(1);
      expect(members[0].name).to.equal('Null-desc policy');
      expect(members[0].description).to.be.null;
    });

    it('excludes a member whose gallery_download link has been ended', async () => {
      const gallery = await seedGallery();
      const { download_id } = await createPolicyDownload();
      await repo.addDownloadToGallery(gallery.gallery_id, download_id, 1);
      await repo.removeDownloadFromGallery(gallery.gallery_id, download_id);

      const members = await repo.getGalleryDownloads(gallery.gallery_id);
      expect(members).to.eql([]);
    });

    it('excludes a member whose download is soft-deleted even though the link is still active', async () => {
      const gallery = await seedGallery();
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

    it('orders by sort ASC NULLS LAST then create_date ASC then gallery_download_id ASC (tiebreaker)', async () => {
      const gallery = await seedGallery();

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

    it('applies pagination to the SQL-ordered gallery download records and returns the total count', async () => {
      const gallery = await seedGallery();
      const first = await createPolicyDownload({ name: 'first' });
      const second = await createPolicyDownload({ name: 'second' });
      const third = await createPolicyDownload({ name: 'third' });

      await repo.addDownloadToGallery(gallery.gallery_id, first.download_id, 1);
      await repo.addDownloadToGallery(gallery.gallery_id, second.download_id, 2);
      await repo.addDownloadToGallery(gallery.gallery_id, third.download_id, 3);

      const result = await repo.getGalleryDownloads(gallery.gallery_id, { page: 2, limit: 1 });

      expect(result.map((member) => member.download_id)).to.eql([second.download_id]);
      expect(await repo.getGalleryDownloadsCount(gallery.gallery_id)).to.equal(3);
    });

    it('returns [] for an empty gallery', async () => {
      const gallery = await seedGallery();

      const members = await repo.getGalleryDownloads(gallery.gallery_id);
      expect(members).to.eql([]);
    });
  });
});
