// Integration test for the request-time download services — verifies that
// `createDownload` writes a policy-driven download row, `getDownloadSource`
// returns `{ policy_id, requested_by }` for the pipeline, status transitions
// behave, and the team-based access flows (`claimDownload`,
// `getAuthorizedDownload`, `getDownloadsByTeamMembership`) still work after
// the cart→policy refactor.
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
import { DEFAULT_MAX_PART_SIZE_BYTES } from '../../constants/download';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { ApiNotFoundError } from '../../errors/api-error';
import { HTTP403, HTTP409 } from '../../errors/http-error';
import { DownloadStatusEnum } from '../../models/download-status';
import { DownloadRepository } from '../../repositories/download/download-repository';
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
  });

  afterEach(async () => {
    sinon.restore();
    await connection.rollback();
    connection.release();
  });

  /**
   * Helper: create a download policy + download row in one shot, returning the
   * download id. Mirrors the route's create-download flow without the team
   * link or job publish, so each test can decide how to wire those.
   */
  async function createPolicyDownload(opts?: {
    name?: string;
    featureTypes?: string[];
  }): Promise<{ download_id: string; policy_id: string }> {
    const { policy_id } = await policyService.createDownloadPolicy({
      name: opts?.name ?? `Test policy ${Date.now()}-${randomUUID().slice(0, 8)}`,
      description: null,
      featureTypes: opts?.featureTypes ?? ['dataset'],
      expressionId: null
    });
    const { download_id } = await downloadService.createDownload({
      policyId: policy_id,
      format: 'parquet',
      requestedBy: connection.systemUserId()
    });
    return { download_id, policy_id };
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
    it('writes a download row with policy_id populated, format set, and status=pending', async () => {
      const { download_id, policy_id } = await createPolicyDownload();

      const row = await connection.sql(SQL`
        SELECT download_status, format, policy_id, create_user
        FROM download WHERE download_id = ${download_id};
      `);
      expect(row.rowCount).to.equal(1);
      expect(row.rows[0].download_status).to.equal(DownloadStatusEnum.PENDING);
      expect(row.rows[0].format).to.equal('parquet');
      expect(row.rows[0].policy_id).to.equal(policy_id);
      expect(row.rows[0].create_user).to.equal(connection.systemUserId());
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

    it('anonymous request: writes requested_by NULL, no team, and one default csv export', async () => {
      stubPublish();

      const { download_id, export_id } = await downloadService.createDownloadRequest({
        name: `Anon request ${Date.now()}-${randomUUID().slice(0, 8)}`,
        description: 'Anonymous download request',
        featureTypes: ['dataset'],
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

      // Exactly one default export is created up front so the returned status URL is stable.
      const exportRows = await connection.sql(SQL`
        SELECT download_export_id, mode, format, max_part_size_bytes, status
        FROM download_export WHERE download_id = ${download_id};
      `);
      expect(exportRows.rowCount).to.equal(1);
      expect(exportRows.rows[0].download_export_id).to.equal(export_id);
      expect(exportRows.rows[0].mode).to.equal('per_feature_type');
      expect(exportRows.rows[0].format).to.equal('csv');
      expect(String(exportRows.rows[0].max_part_size_bytes)).to.equal(DEFAULT_MAX_PART_SIZE_BYTES);
      expect(exportRows.rows[0].status).to.equal(DownloadStatusEnum.PENDING);
    });

    it('authenticated request: writes requested_by, a single-member team, and no up-front export', async () => {
      stubPublish();

      const systemUserId = connection.systemUserId();

      const { download_id, export_id } = await downloadService.createDownloadRequest({
        name: `Auth request ${Date.now()}-${randomUUID().slice(0, 8)}`,
        description: 'Authenticated download request',
        featureTypes: ['dataset'],
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

      // No up-front export — authenticated users create exports later through the UI.
      expect(export_id).to.be.null;
      const exportRows = await connection.sql(SQL`
        SELECT download_export_id FROM download_export WHERE download_id = ${download_id};
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

  describe('full status lifecycle', () => {
    it('transitions pending → processing → ready and tracks the expected timestamps', async () => {
      const { download_id } = await createPolicyDownload();

      const initial = await downloadService.findDownloadById(download_id);
      expect(initial!.download_status).to.equal(DownloadStatusEnum.PENDING);
      expect(initial!.started_at).to.be.null;
      expect(initial!.completed_at).to.be.null;

      await pipelineService.transitionDownloadStatus(download_id, DownloadStatusEnum.PROCESSING, [
        DownloadStatusEnum.PENDING
      ]);
      const processing = await downloadService.findDownloadById(download_id);
      expect(processing!.download_status).to.equal(DownloadStatusEnum.PROCESSING);
      expect(processing!.started_at).to.not.be.null;
      expect(processing!.completed_at).to.be.null;

      const firstStartedAt = processing!.started_at;

      await pipelineService.transitionDownloadStatus(download_id, DownloadStatusEnum.READY, [
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
});
