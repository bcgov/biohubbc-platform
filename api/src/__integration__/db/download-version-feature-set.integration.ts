// Integration test for the download version feature set — verifies the schema contract (the
// feature_ids roaringbitmap column on download_version, NULL for a version that has no stored set)
// and that writes to download_version leave no audit_log journal rows while the audit columns are
// still filled.
//
// Uses a transaction that is ROLLED BACK after each test, so no data is persisted.
//
// Run: make test-db
// Requires: make web (database must be running, migrations applied)

import * as parquetjs from '@dsnp/parquetjs';
import { expect } from 'chai';
import { randomUUID } from 'node:crypto';
import sinon from 'sinon';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { DownloadSource } from '../../models/download';
import { DownloadStatusEnum } from '../../models/download-status';
import { SecurityScopeRepository } from '../../repositories/authorization/security-scope-repository';
import { DownloadRepository } from '../../repositories/download/download-repository';
import { DownloadVersionRepository } from '../../repositories/download/download-version-repository';
import { buildBroadFeatureTypeSubquery } from '../../repositories/expression-evaluation';
import { DownloadPipelineService } from '../../services/download/download-pipeline-service';
import { EffectiveDownloadStatement } from '../../services/download/download-pipeline-service.interface';
import { DownloadPolicyService } from '../../services/download/download-policy-service';
import { DownloadService } from '../../services/download/download-service';
import { ObjectStorageService } from '../../services/object-storage/object-storage-service';
import { SubmissionFeatureClosureService } from '../../services/submission-feature-closure-service';
import { CsvPropertyDefinition } from '../../utils/csv-utils';
import { createTestUpload } from '../helpers/test-feature-property-helpers';
import { createPolicy, createPolicyStatement, secureFeature, setupFullAccess } from '../helpers/test-rbac-helpers';
import { createTestSubmission } from '../helpers/test-submission-helpers';

describe('Download version feature set (integration)', function () {
  this.timeout(15000);

  let connection: IDBConnection;
  let pipelineService: DownloadPipelineService;
  let downloadService: DownloadService;
  let policyService: DownloadPolicyService;
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
    versionRepo = new DownloadVersionRepository(connection);
  });

  afterEach(async () => {
    await connection.rollback();
    connection.release();
  });

  // ── Helpers ──────────────────────────────────────────────────────────

  /**
   * Create a download policy, a download and its version, the way download-service.integration.ts
   * does: no feature set is stored, which is the shape of a version built before the change.
   */
  async function createPolicyDownload(): Promise<{ download_id: string; download_version_id: string }> {
    const { policy_id } = await policyService.createDownloadPolicy({
      name: `Feature set policy ${Date.now()}-${randomUUID().slice(0, 8)}`,
      description: null,
      expressionId: null
    });
    const { download_id } = await downloadService.createDownload({
      policyId: policy_id,
      format: 'parquet',
      requestedBy: connection.systemUserId()
    });
    const version = await versionRepo.createDownloadVersion(download_id);

    return { download_id, download_version_id: version.download_version_id };
  }

  /**
   * Read the audit_log rows the journal trigger wrote for the given version. The trigger writes
   * `table_name` as `<schema>.<table>` and the whole row as JSON, so the version id is in
   * `after_value` (insert, update) or `before_value` (update, delete).
   */
  async function getJournalOperations(downloadVersionId: string): Promise<string[]> {
    const result = await connection.sql(SQL`
      SELECT operation
      FROM audit_log
      WHERE table_name = 'biohub.download_version'
        AND (
          after_value->>'download_version_id' = ${downloadVersionId}
          OR before_value->>'download_version_id' = ${downloadVersionId}
        )
      ORDER BY audit_log_id;
    `);

    return result.rows.map((row) => row.operation);
  }

  async function getTriggerNames(): Promise<string[]> {
    const result = await connection.sql(SQL`
      SELECT tgname
      FROM pg_trigger
      WHERE tgrelid = 'biohub.download_version'::regclass
        AND NOT tgisinternal
      ORDER BY tgname;
    `);

    return result.rows.map((row) => row.tgname);
  }

  // ── Tests ────────────────────────────────────────────────────────────

  it('AC7 download_version has a nullable feature_ids roaringbitmap column with no default', async () => {
    const columns = await connection.sql(SQL`
      SELECT is_nullable, udt_name, column_default
      FROM information_schema.columns
      WHERE table_schema = 'biohub'
        AND table_name = 'download_version'
        AND column_name = 'feature_ids'
    `);

    expect(columns.rows, 'biohub.download_version.feature_ids column').to.have.length(1);
    expect(columns.rows[0].udt_name).to.equal('roaringbitmap');
    expect(columns.rows[0].is_nullable).to.equal('YES');
    expect(columns.rows[0].column_default, 'column default').to.equal(null);
  });

  it('AC7 a version inserted with no feature set has NULL feature_ids and getDownloadVersion returns it as before', async () => {
    const { download_id, download_version_id } = await createPolicyDownload();

    const stored = await connection.sql(SQL`
      SELECT
        feature_ids IS NULL AS feature_ids_is_null,
        rb_cardinality(feature_ids) AS cardinality
      FROM download_version
      WHERE download_version_id = ${download_version_id};
    `);

    expect(stored.rows, 'download_version row').to.have.length(1);
    expect(stored.rows[0].feature_ids_is_null, 'feature_ids IS NULL').to.equal(true);
    expect(stored.rows[0].cardinality, 'rb_cardinality(feature_ids)').to.equal(null);

    const version = await downloadService.getDownloadVersion(download_id, download_version_id);

    expect(version.download_version_id).to.equal(download_version_id);
    expect(version.download_id).to.equal(download_id);
    expect(version.status).to.equal(DownloadStatusEnum.PENDING);
    expect(version.feature_count).to.equal(null);
    expect(version.started_at).to.equal(null);
    expect(version.completed_at).to.equal(null);
    expect(version.materialized_at).to.equal(null);
    expect(version.error_message).to.equal(null);
    expect(version.create_date).to.be.a('string');
  });

  it('AC10 creating a version and moving it to processing writes no audit_log row for download_version', async () => {
    const { download_id, download_version_id } = await createPolicyDownload();

    await pipelineService.transitionDownloadVersionStatus(download_version_id, DownloadStatusEnum.PROCESSING, [
      DownloadStatusEnum.PENDING
    ]);

    // Fixture check: the insert and the update both happened.
    const version = await downloadService.getDownloadVersion(download_id, download_version_id);
    expect(version.status).to.equal(DownloadStatusEnum.PROCESSING);

    expect(await getJournalOperations(download_version_id), 'audit_log rows for the version').to.eql([]);
  });

  it('AC10 create_user, update_user and update_date are set after the version is created and updated', async () => {
    const { download_version_id } = await createPolicyDownload();

    await pipelineService.transitionDownloadVersionStatus(download_version_id, DownloadStatusEnum.PROCESSING, [
      DownloadStatusEnum.PENDING
    ]);

    const result = await connection.sql(SQL`
      SELECT create_user, update_user, update_date
      FROM download_version
      WHERE download_version_id = ${download_version_id};
    `);

    expect(result.rows, 'download_version row').to.have.length(1);
    expect(result.rows[0].create_user).to.equal(connection.systemUserId());
    expect(result.rows[0].update_user).to.equal(connection.systemUserId());
    expect(result.rows[0].update_date, 'update_date').to.not.equal(null);
  });

  it('AC10 download_version keeps the audit_download_version trigger and has no journal_download_version trigger', async () => {
    const triggerNames = await getTriggerNames();

    expect(triggerNames).to.include('audit_download_version');
    expect(triggerNames).to.not.include('journal_download_version');
  });

  // ── The feature set is resolved once at build time, and the files are written from it ──

  describe('feature set resolved at build time', () => {
    afterEach(() => {
      sinon.restore();
    });

    interface FeatureSetFixture {
      downloadId: string;
      downloadVersionId: string;
      source: DownloadSource;
      statements: EffectiveDownloadStatement[];
      schemaLookup: Map<string, CsvPropertyDefinition[]>;
      /** The two feature types created for this test; the download's policy covers only these. */
      featureTypeNames: string[];
      requestedBy: number;
      unsecuredCurrentId: number;
      supersededId: number;
      noSelfLoopId: number;
      securedGrantedId: number;
      securedNotGrantedId: number;
    }

    /** Insert a feature type no other data uses, so the download can select only this test's features. */
    async function createFeatureType(label: string): Promise<string> {
      const name = `fs_${label}_${randomUUID().replaceAll('-', '')}`;
      await connection.sql(SQL`
        INSERT INTO feature_type (name, display_name, create_user)
        VALUES (${name}, ${`Feature set test ${label}`}, ${connection.systemUserId()});
      `);

      return name;
    }

    /** Insert a user with no team, so the only grant it holds is the one the fixture gives it. */
    async function createRequestingUser(): Promise<number> {
      const identifier = `feature-set-test-${randomUUID()}`;
      const result = await connection.sql(SQL`
        INSERT INTO "system_user" (user_identity_source_id, user_identifier, user_guid, create_user)
        VALUES (
          (SELECT user_identity_source_id FROM user_identity_source WHERE name = 'IDIR'),
          ${identifier},
          ${identifier},
          ${connection.systemUserId()}
        )
        RETURNING system_user_id;
      `);

      return result.rows[0].system_user_id;
    }

    /** Insert one published feature of the given type under the given upload. */
    async function insertFeature(
      submissionId: number,
      submissionUploadId: string,
      featureTypeName: string
    ): Promise<number> {
      const result = await connection.sql(SQL`
        INSERT INTO submission_feature (
          submission_id,
          submission_upload_id,
          feature_type_id,
          data,
          data_byte_size,
          record_effective_date
        )
        VALUES (
          ${submissionId},
          ${submissionUploadId}::uuid,
          (SELECT feature_type_id FROM feature_type WHERE name = ${featureTypeName} AND record_end_date IS NULL),
          '{}'::jsonb,
          500,
          now()
        )
        RETURNING submission_feature_id;
      `);

      return result.rows[0].submission_feature_id;
    }

    async function insertSelfLoop(submissionFeatureId: number): Promise<void> {
      await connection.sql(SQL`
        INSERT INTO submission_feature_closure (source_submission_feature_id, target_submission_feature_id, is_ancestor)
        VALUES (${submissionFeatureId}, ${submissionFeatureId}, true)
        ON CONFLICT (source_submission_feature_id, target_submission_feature_id) DO NOTHING;
      `);
    }

    async function hasSelfLoop(submissionFeatureId: number): Promise<boolean> {
      const result = await connection.sql(SQL`
        SELECT 1
        FROM submission_feature_closure
        WHERE source_submission_feature_id = ${submissionFeatureId}
          AND target_submission_feature_id = ${submissionFeatureId};
      `);

      return result.rows.length === 1;
    }

    /**
     * The features the download's policy selects right now for the requesting user, by the same
     * builder the per-type write uses today. Used only to check the fixture, never as the expectation.
     */
    async function selectableNow(fixture: FeatureSetFixture): Promise<number[]> {
      const ids: number[] = [];
      for (const featureTypeName of fixture.featureTypeNames) {
        const { sql, bindings } = buildBroadFeatureTypeSubquery(featureTypeName, fixture.requestedBy)
          .toSQL()
          .toNative();
        const result = await connection.query<{ submission_feature_id: number }>(sql, [...bindings]);
        ids.push(...result.rows.map((row) => row.submission_feature_id));
      }

      return ids.sort((a, b) => a - b);
    }

    /**
     * A download requested by a user, whose policy covers two feature types that hold exactly five
     * features:
     *
     * - type A: a current unsecured feature; a superseded feature (it keeps its closure self-loop, so
     *   only "not current" excludes it)
     * - type B: a current feature with no closure self-loop; a secured feature in a submission the
     *   user's team is granted; a secured feature in a submission the user has no grant for
     */
    async function createFixture(): Promise<FeatureSetFixture> {
      const typeA = await createFeatureType('a');
      const typeB = await createFeatureType('b');
      const featureTypeNames = [typeA, typeB].sort((a, b) => a.localeCompare(b));
      const requestedBy = await createRequestingUser();

      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(connection, submissionId);
      const grantedSubmissionId = await createTestSubmission(connection);
      const grantedUploadId = await createTestUpload(connection, grantedSubmissionId);

      const unsecuredCurrentId = await insertFeature(submissionId, uploadId, typeA);
      const supersededId = await insertFeature(submissionId, uploadId, typeA);
      const noSelfLoopId = await insertFeature(submissionId, uploadId, typeB);
      const securedNotGrantedId = await insertFeature(submissionId, uploadId, typeB);
      const securedGrantedId = await insertFeature(grantedSubmissionId, grantedUploadId, typeB);

      await secureFeature(connection, securedNotGrantedId);
      await secureFeature(connection, securedGrantedId);

      const closureService = new SubmissionFeatureClosureService(connection);
      await closureService.computeClosureForUpload(uploadId);
      await closureService.computeClosureForUpload(grantedUploadId);

      // Supersede one feature after the closure is built, and keep its self-loop.
      await connection.sql(SQL`
        UPDATE submission_feature
        SET successor_submission_feature_id = ${unsecuredCurrentId}
        WHERE submission_feature_id = ${supersededId};
      `);
      await insertSelfLoop(supersededId);

      // Remove the closure of one current feature.
      await connection.sql(SQL`
        DELETE FROM submission_feature_closure
        WHERE source_submission_feature_id = ${noSelfLoopId}
          OR target_submission_feature_id = ${noSelfLoopId};
      `);

      // Grant the requesting user's team the submission that holds one of the secured features.
      await setupFullAccess(
        connection,
        new SecurityScopeRepository(connection),
        `urn:${grantedSubmissionId}:*:*`,
        requestedBy,
        `feature-set-test-team-${randomUUID()}`
      );

      const policyId = await createPolicy(connection, `Feature set policy ${randomUUID()}`);
      await createPolicyStatement(connection, policyId, `urn:*:${typeA}:*`);
      await createPolicyStatement(connection, policyId, `urn:*:${typeB}:*`);

      const { download_id } = await downloadService.createDownload({
        policyId,
        format: 'parquet',
        requestedBy
      });
      const version = await versionRepo.createDownloadVersion(download_id);
      const source = await new DownloadRepository(connection).getDownloadSource(download_id);
      const { schemaLookup, statements } = await pipelineService.resolveParquetSchema(source);

      const fixture: FeatureSetFixture = {
        downloadId: download_id,
        downloadVersionId: version.download_version_id,
        source,
        statements,
        schemaLookup,
        featureTypeNames,
        requestedBy,
        unsecuredCurrentId,
        supersededId,
        noSelfLoopId,
        securedGrantedId,
        securedNotGrantedId
      };

      // Fixture checks: the download is the user's, its policy covers the two types only, the
      // closure is in the state described above, and today's selection is the two expected features.
      expect(source.requested_by, 'source.requested_by').to.equal(requestedBy);
      expect(
        statements.map((statement) => statement.urn_feature_type),
        'feature types of the effective statements'
      ).to.have.members(featureTypeNames);
      expect(statements, 'effective statements').to.have.length(2);
      expect(await hasSelfLoop(unsecuredCurrentId), 'unsecured current feature has a self-loop').to.equal(true);
      expect(await hasSelfLoop(supersededId), 'superseded feature has a self-loop').to.equal(true);
      expect(await hasSelfLoop(noSelfLoopId), 'no-self-loop feature has a self-loop').to.equal(false);
      expect(await hasSelfLoop(securedGrantedId), 'granted secured feature has a self-loop').to.equal(true);
      expect(await hasSelfLoop(securedNotGrantedId), 'ungranted secured feature has a self-loop').to.equal(true);
      expect(await selectableNow(fixture), 'features selectable before the build').to.eql(expectedIds(fixture));

      return fixture;
    }

    /** The set the build must store and write: the unsecured current feature and the granted secured one. */
    function expectedIds(fixture: FeatureSetFixture): number[] {
      return [fixture.unsecuredCurrentId, fixture.securedGrantedId].sort((a, b) => a - b);
    }

    function excludedIds(fixture: FeatureSetFixture): number[] {
      return [fixture.supersededId, fixture.noSelfLoopId, fixture.securedNotGrantedId];
    }

    async function storeFeatureSet(fixture: FeatureSetFixture): Promise<number> {
      return pipelineService.storeDownloadVersionFeatureSet({
        downloadVersionId: fixture.downloadVersionId,
        source: fixture.source,
        statements: fixture.statements
      });
    }

    async function readStoredSet(
      downloadVersionId: string
    ): Promise<{ ids: number[] | null; cardinality: number | null; isRunOptimised: boolean | null }> {
      const result = await connection.sql(SQL`
        SELECT
          rb_to_array(feature_ids) AS ids,
          rb_cardinality(feature_ids)::integer AS cardinality,
          feature_ids::bytea = rb_runoptimize(feature_ids)::bytea AS is_run_optimised
        FROM download_version
        WHERE download_version_id = ${downloadVersionId};
      `);

      expect(result.rows, 'download_version row').to.have.length(1);

      return {
        ids: result.rows[0].ids,
        cardinality: result.rows[0].cardinality,
        isRunOptimised: result.rows[0].is_run_optimised
      };
    }

    /**
     * Write one Parquet file per statement with the Parquet writer and the upload stubbed, and
     * return the features of the rows each file received, by feature type. A row is mapped to its
     * feature through its `uuid`.
     */
    async function writeFilesAndCaptureFeatureIds(fixture: FeatureSetFixture): Promise<Map<string, number[]>> {
      let currentRows: Record<string, unknown>[] = [];
      const writer = sinon.createStubInstance(parquetjs.ParquetWriter);
      writer.appendRow.callsFake(async (row: Record<string, unknown>) => {
        currentRows.push(row);
      });
      writer.close.resolves();
      sinon.stub(parquetjs.ParquetWriter, 'openStream').resolves(writer);
      sinon.stub(ObjectStorageService.prototype, 'uploadStream').resolves();

      const featureIdsByType = new Map<string, number[]>();
      // Split the stored set by feature type once, as the job does: each file is written from its part.
      const fileFeatureSets = await pipelineService.listDownloadVersionFileFeatureSets(
        fixture.downloadVersionId,
        fixture.statements.map((statement) => statement.urn_feature_type)
      );
      for (const statement of fixture.statements) {
        currentRows = [];
        const featureTypeName = statement.urn_feature_type;
        await pipelineService.writeFeatureTypeParquet({
          downloadId: fixture.downloadId,
          downloadVersionId: fixture.downloadVersionId,
          properties: fixture.schemaLookup.get(featureTypeName) ?? [],
          featureTypeName,
          featureIds: fileFeatureSets.find((set) => set.featureTypeName === featureTypeName)?.featureIds ?? null
        });

        const uuids = currentRows.map((row) => String(row.uuid));
        const features = await connection.sql(SQL`
          SELECT submission_feature_id
          FROM submission_feature
          WHERE uuid = ANY(${uuids}::uuid[])
          ORDER BY submission_feature_id;
        `);
        expect(features.rows, `features behind the rows of the ${featureTypeName} file`).to.have.length(uuids.length);
        featureIdsByType.set(
          featureTypeName,
          features.rows.map((row) => row.submission_feature_id)
        );
      }

      return featureIdsByType;
    }

    function allFeatureIds(featureIdsByType: Map<string, number[]>): number[] {
      return Array.from(featureIdsByType.values())
        .flat()
        .sort((a, b) => a - b);
    }

    it('AC2 the stored set holds exactly the unsecured current feature and the granted secured feature, run-optimised', async () => {
      const fixture = await createFixture();

      await storeFeatureSet(fixture);

      const stored = await readStoredSet(fixture.downloadVersionId);
      expect(stored.ids, 'rb_to_array(feature_ids)').to.eql(expectedIds(fixture));
      expect(stored.ids, 'rb_to_array(feature_ids)').to.not.include.members([fixture.supersededId]);
      expect(stored.ids, 'rb_to_array(feature_ids)').to.not.include.members([fixture.noSelfLoopId]);
      expect(stored.ids, 'rb_to_array(feature_ids)').to.not.include.members([fixture.securedNotGrantedId]);
      expect(stored.isRunOptimised, 'feature_ids::bytea = rb_runoptimize(feature_ids)::bytea').to.equal(true);
    });

    it('AC2 the files written after the set is stored hold exactly the same two features, each in its own type', async () => {
      const fixture = await createFixture();

      await storeFeatureSet(fixture);
      const featureIdsByType = await writeFilesAndCaptureFeatureIds(fixture);

      const written = allFeatureIds(featureIdsByType);
      expect(written, 'features in the captured rows').to.eql(expectedIds(fixture));
      for (const excludedId of excludedIds(fixture)) {
        expect(written, 'features in the captured rows').to.not.include(excludedId);
      }

      // One row per file: the unsecured current feature is the only type A feature in the set, the
      // granted secured feature the only type B one.
      const fileOfUnsecured = Array.from(featureIdsByType.entries()).filter(([, ids]) =>
        ids.includes(fixture.unsecuredCurrentId)
      );
      const fileOfGranted = Array.from(featureIdsByType.entries()).filter(([, ids]) =>
        ids.includes(fixture.securedGrantedId)
      );
      expect(fileOfUnsecured, 'files holding the unsecured current feature').to.have.length(1);
      expect(fileOfGranted, 'files holding the granted secured feature').to.have.length(1);
      expect(fileOfUnsecured[0][0]).to.not.equal(fileOfGranted[0][0]);

      const stored = await readStoredSet(fixture.downloadVersionId);
      expect(stored.ids, 'rb_to_array(feature_ids)').to.eql(written);
    });

    it('AC2 a second storeDownloadVersionFeatureSet call, after another feature becomes selectable, leaves the set unchanged and returns the same number', async () => {
      const fixture = await createFixture();

      const firstCount = await storeFeatureSet(fixture);
      const firstStored = await readStoredSet(fixture.downloadVersionId);

      // The current feature that had no closure self-loop gets one, so the policy now selects it.
      await insertSelfLoop(fixture.noSelfLoopId);
      expect(await selectableNow(fixture), 'features selectable before the second call').to.eql(
        [...expectedIds(fixture), fixture.noSelfLoopId].sort((a, b) => a - b)
      );

      const secondCount = await storeFeatureSet(fixture);
      const secondStored = await readStoredSet(fixture.downloadVersionId);

      expect(secondCount, 'second return value').to.equal(firstCount);
      expect(secondStored.ids, 'rb_to_array(feature_ids) after the second call').to.eql(expectedIds(fixture));
      expect(secondStored.ids, 'rb_to_array(feature_ids) after the second call').to.eql(firstStored.ids);
      expect(secondStored.cardinality, 'rb_cardinality(feature_ids) after the second call').to.equal(
        firstStored.cardinality
      );

      // The files written after the second call still hold the set stored by the first.
      const featureIdsByType = await writeFilesAndCaptureFeatureIds(fixture);
      expect(allFeatureIds(featureIdsByType), 'features in the captured rows').to.eql(expectedIds(fixture));
    });

    it('AC3 storeDownloadVersionFeatureSet returns the size of the stored set, which is the number of features in the files', async () => {
      const fixture = await createFixture();

      const count = await storeFeatureSet(fixture);
      const stored = await readStoredSet(fixture.downloadVersionId);
      const featureIdsByType = await writeFilesAndCaptureFeatureIds(fixture);

      expect(count, 'return value').to.equal(2);
      expect(stored.cardinality, 'rb_cardinality(feature_ids)').to.equal(count);
      expect(allFeatureIds(featureIdsByType), 'features in the captured rows').to.have.length(count);
    });
  });
});
