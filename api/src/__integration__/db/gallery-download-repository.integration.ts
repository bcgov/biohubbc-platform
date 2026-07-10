// Integration test for GalleryDownloadRepository — verifies the gallery↔download
// membership SQL against the real database: duplicate detection,
// soft-delete semantics, and the getGalleryDownloads LATERAL join (most-recent
// active version resolution), both-side (gd + download) active filtering, and
// deterministic membership ordering.
//
// Also covers the public landing-page read (getEligibleGalleryDownloads +
// getEligibleGalleryDownloadsCount — latest-active-version status eligibility,
// public-scope filter, hybrid pin/newest ordering, feature_count round-trip,
// count/list parity) and the slug-addressed service gate
// (GalleryDownloadService.getPublicGalleryDownloadsBySlug — private/missing
// indistinguishable 404s, public happy path).
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
import { HTTP404 } from '../../errors/http-error';
import { DownloadStatusEnum } from '../../models/download-status';
import { GalleryRecord, GalleryVisibility } from '../../models/gallery';
import { DownloadVersionRepository } from '../../repositories/download/download-version-repository';
import { GalleryDownloadRepository } from '../../repositories/gallery/gallery-download-repository';
import { GalleryRepository } from '../../repositories/gallery/gallery-repository';
import { DownloadPolicyService } from '../../services/download/download-policy-service';
import { DownloadService } from '../../services/download/download-service';
import { GalleryDownloadService } from '../../services/gallery/gallery-download-service';

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
  let galleryDownloadService: GalleryDownloadService;

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
    galleryDownloadService = new GalleryDownloadService(connection);
  });

  afterEach(async () => {
    await connection.rollback();
    connection.release();
  });

  // ── Helpers ──────────────────────────────────────────────────────────────

  /** Create an active gallery with unique name + slug (public unless overridden). */
  function seedGallery(opts?: { visibility?: GalleryVisibility }): Promise<GalleryRecord> {
    const suffix = randomUUID().slice(0, 8);
    return galleryRepo.createGallery({
      name: `Gallery ${suffix}`,
      slug: `gallery-${suffix}`,
      visibility: opts?.visibility ?? 'public',
      description: null
    });
  }

  /**
   * Seed a fully-readable download: policy → download → active download_version.
   * `download.policy_id` is NOT NULL and a download with no active version is
   * invisible to getGalleryDownloads' INNER JOIN LATERAL, so all three links are
   * required for the member to surface. Mirrors download-service.integration.ts's
   * createPolicyDownload helper, using the same shared connection.
   *
   * `requestedBy` defaults to the connection's system user (a user-scoped export);
   * pass an explicit `null` for a public-scope export, which is the only kind the
   * eligible landing read advertises.
   */
  async function createPolicyDownload(opts?: {
    name?: string;
    description?: string | null;
    requestedBy?: number | null;
  }): Promise<{ download_id: string; policy_id: string; download_version_id: string }> {
    const { policy_id } = await policyService.createDownloadPolicy({
      name: opts?.name ?? unique('Policy'),
      description: opts?.description ?? null,
      expressionId: null
    });
    const { download_id } = await downloadService.createDownload({
      policyId: policy_id,
      format: 'parquet',
      requestedBy: opts?.requestedBy === undefined ? connection.systemUserId() : opts.requestedBy
    });
    const version = await versionRepo.createDownloadVersion(download_id);
    return { download_id, policy_id, download_version_id: version.download_version_id };
  }

  /**
   * Seed a download that the public landing read considers advertisable:
   * public-scope (`requested_by IS NULL`) with its version transitioned to
   * `ready` (optionally carrying a stored feature_count).
   */
  async function createEligibleDownload(opts?: {
    name?: string;
    featureCount?: number;
  }): Promise<{ download_id: string; policy_id: string; download_version_id: string }> {
    const download = await createPolicyDownload({ name: opts?.name, requestedBy: null });
    await versionRepo.updateDownloadVersionStatus(
      download.download_version_id,
      DownloadStatusEnum.READY,
      opts?.featureCount === undefined ? undefined : { feature_count: opts.featureCount }
    );
    return download;
  }

  /**
   * Insert an additional download_version with an explicit create_date offset.
   * Versions default to the transaction-frozen now() (so same-transaction inserts
   * tie on create_date and fall through to a nondeterministic UUID tie-break), and
   * the audit trigger makes create_date immutable on UPDATE — so controlled
   * version recency must be set at INSERT time via raw SQL.
   */
  async function insertVersionAt(downloadId: string, status: DownloadStatusEnum, offset: string): Promise<string> {
    const result = await connection.sql(SQL`
      INSERT INTO download_version (download_id, status, create_date)
      VALUES (${downloadId}, ${status}, now() + ${offset}::interval)
      RETURNING download_version_id;
    `);
    return result.rows[0].download_version_id;
  }

  /**
   * Insert a gallery membership with an explicit create_date offset — same
   * frozen-now() rationale as insertVersionAt: membership recency ordering can
   * only be exercised with create_date set at INSERT time.
   */
  async function addMembershipAt(
    galleryId: number,
    downloadId: string,
    sort: number | null,
    offset: string
  ): Promise<void> {
    await connection.sql(SQL`
      INSERT INTO gallery_download (gallery_id, download_id, sort, create_date)
      VALUES (${galleryId}, ${downloadId}, ${sort}, now() + ${offset}::interval);
    `);
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

  // ── getEligibleGalleryDownloads / getEligibleGalleryDownloadsCount ───────
  // The public landing-page read: latest-active-version status eligibility,
  // public-scope filter, hybrid pin/newest ordering, and count/list parity.

  describe('getEligibleGalleryDownloads / getEligibleGalleryDownloadsCount', () => {
    it('returns only memberships whose latest version is ready or downloaded, round-trips feature_count, and the count matches', async () => {
      const gallery = await seedGallery();

      const ready = await createEligibleDownload({ name: 'ready', featureCount: 17412 });
      const downloaded = await createPolicyDownload({ name: 'downloaded', requestedBy: null });
      await versionRepo.updateDownloadVersionStatus(downloaded.download_version_id, DownloadStatusEnum.DOWNLOADED);
      const pending = await createPolicyDownload({ name: 'pending', requestedBy: null }); // versions are born pending
      const failed = await createPolicyDownload({ name: 'failed', requestedBy: null });
      await versionRepo.updateDownloadVersionStatus(failed.download_version_id, DownloadStatusEnum.FAILED);

      for (const download of [ready, downloaded, pending, failed]) {
        await repo.addDownloadToGallery(gallery.gallery_id, download.download_id, null);
      }

      const rows = await repo.getEligibleGalleryDownloads(gallery.gallery_id);
      expect(rows.map((row) => row.download_id)).to.have.members([ready.download_id, downloaded.download_id]);

      // The stored feature_count survives the LATERAL projection + Zod parse intact.
      const readyRow = rows.find((row) => row.download_id === ready.download_id);
      expect(readyRow?.feature_count).to.equal(17412);

      // Filter parity: the filtered-out pending/failed rows must not inflate the total.
      expect(await repo.getEligibleGalleryDownloadsCount(gallery.gallery_id)).to.equal(2);
    });

    it('excludes a user-scoped download (requested_by set) from both list and count even when its latest version is ready', async () => {
      const gallery = await seedGallery();

      // requested_by is the security identity the parquet was built with — a
      // user-scoped export must never be advertised publicly, whatever its status.
      const userScoped = await createPolicyDownload({ requestedBy: connection.systemUserId() });
      await versionRepo.updateDownloadVersionStatus(userScoped.download_version_id, DownloadStatusEnum.READY);
      await repo.addDownloadToGallery(gallery.gallery_id, userScoped.download_id, null);

      expect(await repo.getEligibleGalleryDownloads(gallery.gallery_id)).to.eql([]);
      expect(await repo.getEligibleGalleryDownloadsCount(gallery.gallery_id)).to.equal(0);
    });

    it('excludes a download whose latest active version is failed even when an older version was ready', async () => {
      const gallery = await seedGallery();

      // Older version ready (frozen now()); strictly newer version failed. Eligibility
      // is judged on the most recent active version only — the LATERAL resolves the
      // latest first, then the status filter judges that one row, so the older ready
      // version can never resurrect the download.
      const download = await createEligibleDownload();
      await insertVersionAt(download.download_id, DownloadStatusEnum.FAILED, '1 second');
      await repo.addDownloadToGallery(gallery.gallery_id, download.download_id, null);

      expect(await repo.getEligibleGalleryDownloads(gallery.gallery_id)).to.eql([]);
      expect(await repo.getEligibleGalleryDownloadsCount(gallery.gallery_id)).to.equal(0);
    });

    it('includes a download whose newest version is soft-deleted when its newest ACTIVE version is ready', async () => {
      const gallery = await seedGallery();

      // Newest version soft-deleted; the LATERAL only considers active versions,
      // so the older still-active ready version keeps the download advertisable.
      const download = await createEligibleDownload();
      const newerVersionId = await insertVersionAt(download.download_id, DownloadStatusEnum.FAILED, '1 second');
      await connection.sql(
        SQL`UPDATE download_version SET record_end_date = now() WHERE download_version_id = ${newerVersionId};`
      );
      await repo.addDownloadToGallery(gallery.gallery_id, download.download_id, null);

      const rows = await repo.getEligibleGalleryDownloads(gallery.gallery_id);
      expect(rows.map((row) => row.download_id)).to.eql([download.download_id]);
      expect(await repo.getEligibleGalleryDownloadsCount(gallery.gallery_id)).to.equal(1);
    });

    it('orders pinned memberships first, then unpinned newest-membership-first (gd.create_date DESC)', async () => {
      const gallery = await seedGallery();

      const pinned = await createEligibleDownload({ name: 'pinned' });
      const oldest = await createEligibleDownload({ name: 'unpinned-oldest' });
      const middle = await createEligibleDownload({ name: 'unpinned-middle' });
      const newest = await createEligibleDownload({ name: 'unpinned-newest' });

      // The pin has the OLDEST membership create_date — it must still lead, proving
      // sort wins over recency. Unpinned rows follow newest membership first:
      // "newest" is the membership's create_date (newly curated), not the download's.
      await addMembershipAt(gallery.gallery_id, pinned.download_id, 1, '-3 seconds');
      await addMembershipAt(gallery.gallery_id, oldest.download_id, null, '-2 seconds');
      await addMembershipAt(gallery.gallery_id, middle.download_id, null, '-1 second');
      await addMembershipAt(gallery.gallery_id, newest.download_id, null, '0 seconds');

      const orderedIds = (await repo.getEligibleGalleryDownloads(gallery.gallery_id)).map((row) => row.download_id);
      expect(orderedIds).to.eql([pinned.download_id, newest.download_id, middle.download_id, oldest.download_id]);
    });

    it('breaks same-timestamp membership ties by gallery_download_id DESC (later insert first, deterministic)', async () => {
      const gallery = await seedGallery();

      const first = await createEligibleDownload({ name: 'inserted-first' });
      const second = await createEligibleDownload({ name: 'inserted-second' });

      // Both memberships share the transaction-frozen now() create_date, so the
      // ordering falls through to the identity-column tie-break: the later insert
      // (higher gallery_download_id) comes first under DESC.
      await repo.addDownloadToGallery(gallery.gallery_id, first.download_id, null);
      await repo.addDownloadToGallery(gallery.gallery_id, second.download_id, null);

      const orderedIds = (await repo.getEligibleGalleryDownloads(gallery.gallery_id)).map((row) => row.download_id);
      expect(orderedIds).to.eql([second.download_id, first.download_id]);
    });

    it('returns feature_count: null for a ready version materialized before counting existed', async () => {
      const gallery = await seedGallery();

      const download = await createPolicyDownload({ requestedBy: null });
      await versionRepo.updateDownloadVersionStatus(download.download_version_id, DownloadStatusEnum.READY);
      await repo.addDownloadToGallery(gallery.gallery_id, download.download_id, null);

      const rows = await repo.getEligibleGalleryDownloads(gallery.gallery_id);
      expect(rows).to.have.length(1);
      expect(rows[0].feature_count).to.be.null;
    });

    it('paginates ({ limit: 9, page: 2 } over 10 eligible → 1 row) while the count reports the full eligible total', async () => {
      const gallery = await seedGallery();

      const downloads = [];
      for (let i = 0; i < 10; i++) {
        const download = await createEligibleDownload({ name: `tile-${i}` });
        await repo.addDownloadToGallery(gallery.gallery_id, download.download_id, null);
        downloads.push(download);
      }

      const pageTwo = await repo.getEligibleGalleryDownloads(gallery.gallery_id, { limit: 9, page: 2 });

      // Same-frozen-now() memberships order gallery_download_id DESC, so the
      // first-inserted membership is the single row left on page 2.
      expect(pageTwo.map((row) => row.download_id)).to.eql([downloads[0].download_id]);
      expect(await repo.getEligibleGalleryDownloadsCount(gallery.gallery_id)).to.equal(10);
    });
  });

  // ── GalleryDownloadService.getPublicGalleryDownloadsBySlug ───────────────
  // Service-level: the slug-addressed visibility gate on top of the eligible read.

  describe('GalleryDownloadService.getPublicGalleryDownloadsBySlug', () => {
    it('throws identical HTTP404s for a private gallery and a missing slug (a private gallery must be indistinguishable from a missing one)', async () => {
      const privateGallery = await seedGallery({ visibility: 'private' });

      let privateError: unknown;
      try {
        await galleryDownloadService.getPublicGalleryDownloadsBySlug(privateGallery.slug);
        expect.fail('Expected HTTP404 for a private gallery');
      } catch (error) {
        privateError = error;
      }

      let missingError: unknown;
      try {
        await galleryDownloadService.getPublicGalleryDownloadsBySlug(`missing-${randomUUID().slice(0, 8)}`);
        expect.fail('Expected HTTP404 for a missing slug');
      } catch (error) {
        missingError = error;
      }

      expect(privateError).to.be.instanceOf(HTTP404);
      expect(missingError).to.be.instanceOf(HTTP404);
      // The indistinguishability contract: a distinct status or message would
      // disclose that a hidden gallery exists.
      expect((privateError as HTTP404).status).to.equal((missingError as HTTP404).status);
      expect((privateError as HTTP404).message).to.equal((missingError as HTTP404).message);
    });

    it('returns the eligible tiles and count for a public gallery slug', async () => {
      const gallery = await seedGallery();

      const eligible = await createEligibleDownload({ name: 'advertised', featureCount: 42 });
      const ineligible = await createPolicyDownload({ name: 'still-pending', requestedBy: null });
      await repo.addDownloadToGallery(gallery.gallery_id, eligible.download_id, null);
      await repo.addDownloadToGallery(gallery.gallery_id, ineligible.download_id, null);

      const result = await galleryDownloadService.getPublicGalleryDownloadsBySlug(gallery.slug);

      expect(result.count).to.equal(1);
      expect(result.downloads.map((row) => row.download_id)).to.eql([eligible.download_id]);
      expect(result.downloads[0].feature_count).to.equal(42);
    });
  });
});
