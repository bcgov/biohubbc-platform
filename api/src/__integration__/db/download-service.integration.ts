// Integration test for the request-time download services — verifies that
// `createDownload` writes a policy-driven download row, `getDownloadSource`
// returns `{ policy_id, requested_by }` for the pipeline, status transitions
// behave, and the team-based access flows (`claimDownload`,
// `getAuthorizedDownload`, `getDownloadsByTeamMembership`) still work after
// the policy-backed download refactor.
//
// DownloadService = request-time operations (path handlers)
// DownloadPipelineService = background processing (pg-boss job handler only)
//
// Uses a transaction that is ROLLED BACK after each test, so no data is persisted.
//
// Run: make test-db
// Requires: make web (database must be running with seed data)

import { expect } from 'chai';
import { randomUUID } from 'node:crypto';
import sinon from 'sinon';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { ApiNotFoundError } from '../../errors/api-error';
import { HTTP403, HTTP409 } from '../../errors/http-error';
import { DownloadStatusEnum } from '../../models/download-status';
import { DownloadRepository } from '../../repositories/download/download-repository';
import { DownloadVersionRepository } from '../../repositories/download/download-version-repository';
import { DownloadPipelineService } from '../../services/download/download-pipeline-service';
import { DownloadPolicyService } from '../../services/download/download-policy-service';
import { DownloadService } from '../../services/download/download-service';

describe('Download services (integration)', function () {
  this.timeout(15000);

  let connection: IDBConnection;
  let pipelineService: DownloadPipelineService;
  let downloadService: DownloadService;
  let policyService: DownloadPolicyService;
  let downloadRepo: DownloadRepository;
  let versionRepo: DownloadVersionRepository;

  before(() => {
    initDBPool(defaultPoolConfig);
  });

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    pipelineService = new DownloadPipelineService(connection);
    downloadService = new DownloadService(connection);
    policyService = new DownloadPolicyService(connection);
    downloadRepo = new DownloadRepository(connection);
    versionRepo = new DownloadVersionRepository(connection);
  });

  afterEach(async () => {
    sinon.restore();
    await connection.rollback();
    connection.release();
  });

  /**
   * Helper: create a download policy + download row + its 1:1 version in one shot,
   * returning the download id and version id. Mirrors the route's create-download
   * flow (which materializes a version) without the team link or job publish, so
   * each test can decide how to wire those. The version is required: read paths
   * resolve the most-recent version for the download's status, so a versionless
   * download is invisible.
   */
  async function createPolicyDownload(opts?: {
    name?: string;
    description?: string | null;
  }): Promise<{ download_id: string; policy_id: string; download_version_id: string }> {
    const { policy_id } = await policyService.createDownloadPolicy({
      name: opts?.name ?? `Test policy ${Date.now()}-${randomUUID().slice(0, 8)}`,
      description: opts?.description ?? null,
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

  /**
   * Helper: create a fresh system_user — used for team-membership negative cases.
   */
  let _userSeq = 0;
  async function createOtherUser(): Promise<number> {
    const apiUserId = connection.systemUserId();
    const guid = `test-other-${Date.now()}-${++_userSeq}`;

    const result = await connection.sql(SQL`
      INSERT INTO "system_user" (user_identity_source_id, user_identifier, user_guid, record_effective_date, create_user)
      SELECT user_identity_source_id, ${guid}, ${guid}, now(), ${apiUserId}
      FROM user_identity_source
      WHERE record_end_date IS NULL
      LIMIT 1
      RETURNING system_user_id;
    `);

    return result.rows[0].system_user_id;
  }

  describe('createDownload', () => {
    it('writes a download row with policy_id populated and format set', async () => {
      const { download_id, policy_id } = await createPolicyDownload();

      const row = await connection.sql(SQL`
        SELECT format, policy_id, create_user
        FROM download WHERE download_id = ${download_id};
      `);
      expect(row.rowCount).to.equal(1);
      expect(row.rows[0].format).to.equal('parquet');
      expect(row.rows[0].policy_id).to.equal(policy_id);
      expect(row.rows[0].create_user).to.equal(connection.systemUserId());
    });

    it('the download reads status=pending from its freshly-materialized version', async () => {
      const { download_id } = await createPolicyDownload();

      // Status lives on the version (default 'pending') and is sourced back onto the
      // download via the current-version JOIN in findDownloadById.
      const detail = await downloadService.findDownloadById(download_id);
      expect(detail!.download_status).to.equal(DownloadStatusEnum.PENDING);
    });
  });

  describe('createDownloadRequest', () => {
    /**
     * Stub the pg-boss publish so the request never reaches the real queue from
     * inside the rolled-back test transaction. The DB-side wiring (policy,
     * download, team/export rows) is exactly what these tests verify.
     */
    function stubPublish(): void {
      sinon.stub(DownloadService.dependencies, 'publishProcessDownloadJob').resolves({
        status: 'published',
        jobId: 'job-1'
      });
    }

    it('anonymous request: writes requested_by NULL, no team, and no export', async () => {
      stubPublish();

      const { download_id } = await downloadService.createDownloadRequest({
        name: `Anon request ${Date.now()}-${randomUUID().slice(0, 8)}`,
        description: 'Anonymous download request',
        expression: null,
        requestedBy: null
      });

      // requested_by IS NULL — asserted at the DB level to catch a silent NULL→number leak.
      const downloadRow = await connection.sql(SQL`
        SELECT requested_by FROM download WHERE download_id = ${download_id};
      `);
      expect(downloadRow.rowCount).to.equal(1);
      expect(downloadRow.rows[0].requested_by).to.be.null;

      // Anonymous downloads get no team link — the UUID is the access credential.
      const teamRows = await connection.sql(SQL`
        SELECT download_team_id FROM download_team WHERE download_id = ${download_id};
      `);
      expect(teamRows.rowCount).to.equal(0);

      // No export is created at request time — any later export is a separate user action.
      const exportRows = await connection.sql(SQL`
        SELECT dve.download_version_export_id
        FROM download_version_export dve
        INNER JOIN download_version dv ON dv.download_version_id = dve.download_version_id
        WHERE dv.download_id = ${download_id};
      `);
      expect(exportRows.rowCount).to.equal(0);
    });

    it('authenticated request: writes requested_by, a single-member team, and no up-front export', async () => {
      stubPublish();

      const systemUserId = connection.systemUserId();

      const { download_id } = await downloadService.createDownloadRequest({
        name: `Auth request ${Date.now()}-${randomUUID().slice(0, 8)}`,
        description: 'Authenticated download request',
        expression: null,
        requestedBy: systemUserId
      });

      // requested_by carries the security identity the export is later filtered for.
      const downloadRow = await connection.sql(SQL`
        SELECT requested_by FROM download WHERE download_id = ${download_id};
      `);
      expect(downloadRow.rowCount).to.equal(1);
      expect(downloadRow.rows[0].requested_by).to.equal(systemUserId);

      // Authenticated requests seed a single-member team from the same identity.
      const teamRows = await connection.sql(SQL`
        SELECT download_team_id FROM download_team WHERE download_id = ${download_id};
      `);
      expect(teamRows.rowCount).to.equal(1);

      // No up-front export — exports are created later by user action.
      const exportRows = await connection.sql(SQL`
        SELECT dve.download_version_export_id
        FROM download_version_export dve
        INNER JOIN download_version dv ON dv.download_version_id = dve.download_version_id
        WHERE dv.download_id = ${download_id};
      `);
      expect(exportRows.rowCount).to.equal(0);
    });
  });

  describe('getDownloadSource', () => {
    it('returns policy_id and requested_by for an existing download', async () => {
      const { download_id, policy_id } = await createPolicyDownload();

      const source = await downloadRepo.getDownloadSource(download_id);
      expect(source.policy_id).to.equal(policy_id);
      expect(source.requested_by).to.equal(connection.systemUserId());
    });

    it('throws ApiNotFoundError when the download does not exist', async () => {
      try {
        // Random valid UUID that is not in the table.
        await downloadRepo.getDownloadSource('00000000-0000-0000-0000-000000000000');
        expect.fail('Expected ApiNotFoundError');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }
    });
  });

  describe('findDownloadById — policy join', () => {
    it('returns joined policy name and description when both are populated', async () => {
      const { download_id } = await createPolicyDownload({
        name: 'Policy with both fields',
        description: 'A described policy'
      });

      const record = await downloadRepo.findDownloadById(download_id);
      expect(record).to.not.be.null;
      expect(record!.name).to.equal('Policy with both fields');
      expect(record!.description).to.equal('A described policy');
    });

    it('returns description: null when the policy description is NULL', async () => {
      const { download_id } = await createPolicyDownload({
        name: 'Policy without description',
        description: null
      });

      const record = await downloadRepo.findDownloadById(download_id);
      expect(record).to.not.be.null;
      expect(record!.name).to.equal('Policy without description');
      expect(record!.description).to.be.null;
    });

    it('returns null for an unknown downloadId', async () => {
      const record = await downloadRepo.findDownloadById('00000000-0000-0000-0000-000000000000');
      expect(record).to.be.null;
    });
  });

  describe('full status lifecycle', () => {
    it('transitions pending → processing → ready and tracks the expected timestamps', async () => {
      const { download_id, download_version_id: downloadVersionId } = await createPolicyDownload();

      const initial = await downloadService.findDownloadById(download_id);
      expect(initial!.download_status).to.equal(DownloadStatusEnum.PENDING);
      expect(initial!.started_at).to.be.null;
      expect(initial!.completed_at).to.be.null;

      await pipelineService.transitionDownloadVersionStatus(downloadVersionId, DownloadStatusEnum.PROCESSING, [
        DownloadStatusEnum.PENDING
      ]);
      const processing = await downloadService.findDownloadById(download_id);
      expect(processing!.download_status).to.equal(DownloadStatusEnum.PROCESSING);
      expect(processing!.started_at).to.not.be.null;
      expect(processing!.completed_at).to.be.null;

      const firstStartedAt = processing!.started_at;

      await pipelineService.transitionDownloadVersionStatus(downloadVersionId, DownloadStatusEnum.READY, [
        DownloadStatusEnum.PROCESSING
      ]);
      const ready = await downloadService.findDownloadById(download_id);
      expect(ready!.download_status).to.equal(DownloadStatusEnum.READY);
      expect(ready!.started_at).to.equal(firstStartedAt);
      expect(ready!.completed_at).to.not.be.null;
    });
  });

  describe('claimDownload', () => {
    it('creates team association for an anonymous download', async () => {
      const { download_id } = await createPolicyDownload();
      const systemUserId = connection.systemUserId();

      // Before claim: anonymous access works (no team rows -> UUID is the credential)
      await downloadService.getAuthorizedDownload(download_id, null);

      // Claim creates team + download_team link
      await downloadService.claimDownload(download_id, systemUserId);

      // After claim: team member can access
      await downloadService.getAuthorizedDownload(download_id, systemUserId);
    });

    it('fails when download is already claimed', async () => {
      const { download_id } = await createPolicyDownload();
      const systemUserId = connection.systemUserId();

      await downloadService.claimDownload(download_id, systemUserId);

      try {
        await downloadService.claimDownload(download_id, systemUserId);
        expect.fail('Expected HTTP409');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP409);
        expect((error as HTTP409).message).to.equal('Download already claimed');
      }
    });
  });

  describe('getAuthorizedDownload', () => {
    it('allows access to an anonymous (no-team) download for any caller', async () => {
      const { download_id } = await createPolicyDownload();

      const download = await downloadService.getAuthorizedDownload(download_id, null);
      expect(download.download_id).to.equal(download_id);
    });

    it('authorizes a team member on a team-linked download', async () => {
      const { download_id } = await createPolicyDownload();
      const systemUserId = connection.systemUserId();
      await downloadService.linkDownloadToNewTeam(download_id, systemUserId, 'Auth team', 'Auth team');

      const download = await downloadService.getAuthorizedDownload(download_id, systemUserId);
      expect(download.download_id).to.equal(download_id);
    });

    it('rejects a non-team-member with HTTP403 on a team-linked download', async () => {
      const { download_id } = await createPolicyDownload();
      const systemUserId = connection.systemUserId();
      await downloadService.linkDownloadToNewTeam(download_id, systemUserId, 'Auth team', 'Auth team');

      const outsider = await createOtherUser();
      try {
        await downloadService.getAuthorizedDownload(download_id, outsider);
        expect.fail('Expected HTTP403');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP403);
      }
    });

    it('rejects unauthenticated access to a team-linked download with HTTP403', async () => {
      const { download_id } = await createPolicyDownload();
      const systemUserId = connection.systemUserId();
      await downloadService.linkDownloadToNewTeam(download_id, systemUserId, 'Auth team', 'Auth team');

      try {
        await downloadService.getAuthorizedDownload(download_id, null);
        expect.fail('Expected HTTP403');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP403);
      }
    });
  });

  describe('getDownloadsByTeamMembership', () => {
    it('returns downloads linked via team membership', async () => {
      const { download_id } = await createPolicyDownload();
      const systemUserId = connection.systemUserId();
      await downloadService.linkDownloadToNewTeam(download_id, systemUserId, 'Listing team', 'Listing team');

      const { downloads } = await downloadService.getDownloadsByTeamMembership(systemUserId);
      const ids = downloads.map((d) => d.download_id);
      expect(ids).to.include(download_id);
    });

    it('does not return downloads the user has no team membership for', async () => {
      const { download_id } = await createPolicyDownload();

      const otherUserId = await createOtherUser();
      const { downloads } = await downloadService.getDownloadsByTeamMembership(otherUserId);
      const ids = downloads.map((d) => d.download_id);
      expect(ids).to.not.include(download_id);
    });
  });

  // ── Most-recent-version resolution ───────────────────────────────────
  // There is no stored current-version pointer: detail + list reads resolve the
  // most-recent ACTIVE (record_end_date IS NULL) version via a LATERAL ordered
  // create_date DESC, download_version_id DESC. These tests prove a re-run's newer
  // version surfaces without flipping any pointer, and that the active filter
  // falls back to the prior version when the newest is soft-deleted.
  describe('most-recent-version resolution', () => {
    it('detail and list both resolve the most-recent (second) version', async () => {
      const { download_id } = await createPolicyDownload();
      const systemUserId = connection.systemUserId();
      await downloadService.linkDownloadToNewTeam(download_id, systemUserId, 'Resolve team', 'Resolve team');

      const v1 = await downloadRepo.findDownloadById(download_id);
      const firstVersionId = v1!.download_version_id;

      // Insert a strictly-later second version. download_version_id is a random UUID
      // and the LATERAL tiebreaks on it DESC after create_date DESC — a same-tick
      // insert would be flaky, so force create_date one second later.
      const insert = await connection.sql(SQL`
        INSERT INTO download_version (download_id, status, create_date)
        VALUES (${download_id}, ${DownloadStatusEnum.READY}, now() + interval '1 second')
        RETURNING download_version_id;
      `);
      const secondVersionId = insert.rows[0].download_version_id;
      expect(secondVersionId).to.not.equal(firstVersionId);

      // Detail read resolves the second version, carrying its status.
      const detail = await downloadRepo.findDownloadById(download_id);
      expect(detail!.download_version_id).to.equal(secondVersionId);
      expect(detail!.download_status).to.equal(DownloadStatusEnum.READY);

      // List read resolves the same second version.
      const { downloads } = await downloadService.getDownloadsByTeamMembership(systemUserId);
      const listed = downloads.find((d) => d.download_id === download_id);
      expect(listed, 'download should be visible via team membership').to.not.be.undefined;
      expect(listed!.download_version_id).to.equal(secondVersionId);
    });

    it('skips a soft-deleted newer version and falls back to the prior active version', async () => {
      const { download_id } = await createPolicyDownload();

      const v1 = await downloadRepo.findDownloadById(download_id);

      // A strictly-later but already-ended (record_end_date set) version must be
      // ignored by the active filter — resolution falls back to the original.
      const insert = await connection.sql(SQL`
        INSERT INTO download_version (download_id, create_date, record_end_date)
        VALUES (${download_id}, now() + interval '1 second', now())
        RETURNING download_version_id;
      `);
      const softDeletedVersionId = insert.rows[0].download_version_id;

      const detail = await downloadRepo.findDownloadById(download_id);
      expect(detail!.download_version_id).to.equal(v1!.download_version_id);
      expect(detail!.download_version_id).to.not.equal(softDeletedVersionId);
    });
  });
});
