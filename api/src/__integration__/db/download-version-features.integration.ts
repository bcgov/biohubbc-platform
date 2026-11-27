// Integration test for a download version's feature list — verifies that
// `DownloadService.listDownloadVersionFeatures` pages through exactly the features of the version's
// stored set (the same features its export files hold), that the list, the set and the count do not
// move when features are later superseded, secured or lose their closure, that a version with no
// stored set lists what the download's expression selects now and says so, and which callers the
// `Download` authorization admits.
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
import { ensureHTTPError, HTTP409 } from '../../errors/http-error';
import { DownloadSource } from '../../models/download';
import { DownloadStatusEnum } from '../../models/download-status';
import { SecurityScopeRepository } from '../../repositories/authorization/security-scope-repository';
import { DownloadRepository } from '../../repositories/download/download-repository';
import { DownloadVersionRepository } from '../../repositories/download/download-version-repository';
import { buildBroadFeatureTypeSubquery } from '../../repositories/expression-evaluation';
import { DownloadPipelineService, EffectiveDownloadStatement } from '../../services/download/download-pipeline-service';
import { DownloadPolicyService } from '../../services/download/download-policy-service';
import { DownloadService } from '../../services/download/download-service';
import { ObjectStorageService } from '../../services/object-storage/object-storage-service';
import { SubmissionFeatureClosureService } from '../../services/submission-feature-closure-service';
import { CsvPropertyDefinition } from '../../utils/csv-utils';
import { createTestUpload } from '../helpers/test-feature-property-helpers';
import { createPolicy, createPolicyStatement, secureFeature, setupFullAccess } from '../helpers/test-rbac-helpers';
import { createTestSubmission } from '../helpers/test-submission-helpers';

describe('Download version features (integration)', function () {
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
    sinon.restore();
    await connection.rollback();
    connection.release();
  });

  // ── Fixture ──────────────────────────────────────────────────────────

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
    /** Extra current unsecured features with a closure self-loop, two per feature type when asked for. */
    extraTypeAIds: number[];
    extraTypeBIds: number[];
  }

  /** One page of the list, as the service returns it. */
  interface FeaturePage {
    features: {
      submission_feature_id: number;
      uuid: string;
      submission_id: number;
      feature_type_id: number;
      feature_type_name: string;
    }[];
    count: number;
    is_snapshot: boolean;
  }

  /** Insert a feature type no other data uses, so the download can select only this test's features. */
  async function createFeatureType(label: string): Promise<string> {
    const name = `vf_${label}_${randomUUID().replaceAll('-', '')}`;
    await connection.sql(SQL`
      INSERT INTO feature_type (name, display_name, create_user)
      VALUES (${name}, ${`Version features test ${label}`}, ${connection.systemUserId()});
    `);

    return name;
  }

  /** Insert a user with no team, so the only grants and memberships it holds are the ones a test gives it. */
  async function createUser(): Promise<number> {
    const identifier = `version-features-test-${randomUUID()}`;
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

  async function countClosureRows(submissionFeatureId: number): Promise<number> {
    const result = await connection.sql(SQL`
      SELECT count(*)::integer AS count
      FROM submission_feature_closure
      WHERE source_submission_feature_id = ${submissionFeatureId}
        OR target_submission_feature_id = ${submissionFeatureId};
    `);

    return result.rows[0].count;
  }

  /**
   * The features the download's policy selects right now for the requesting user, by the builder the
   * build uses. Used only to check the fixture and that a later change really bites, never as the
   * expectation of a list.
   */
  async function selectableNow(fixture: FeatureSetFixture): Promise<number[]> {
    const ids: number[] = [];
    for (const featureTypeName of fixture.featureTypeNames) {
      const { sql, bindings } = buildBroadFeatureTypeSubquery(featureTypeName, fixture.requestedBy).toSQL().toNative();
      const result = await connection.query<{ submission_feature_id: number }>(sql, [...bindings]);
      ids.push(...result.rows.map((row) => row.submission_feature_id));
    }

    return sortIds(ids);
  }

  function sortIds(ids: number[]): number[] {
    return [...ids].sort((a, b) => a - b);
  }

  /**
   * The AC2 fixture of download-version-feature-set.integration.ts: a download requested by a user,
   * whose policy covers two feature types that hold
   *
   * - type A: a current unsecured feature; a superseded feature (it keeps its closure self-loop)
   * - type B: a current feature with no closure self-loop; a secured feature in a submission the
   *   user's team is granted; a secured feature in a submission the user has no grant for
   *
   * With `extraFeatures`, each type also holds two more current unsecured features, so the set the
   * build stores has six features over the two types.
   */
  async function createFixture(options: { extraFeatures: boolean }): Promise<FeatureSetFixture> {
    const typeA = await createFeatureType('a');
    const typeB = await createFeatureType('b');
    const featureTypeNames = [typeA, typeB].sort((a, b) => a.localeCompare(b));
    const requestedBy = await createUser();

    const submissionId = await createTestSubmission(connection);
    const uploadId = await createTestUpload(connection, submissionId);
    const grantedSubmissionId = await createTestSubmission(connection);
    const grantedUploadId = await createTestUpload(connection, grantedSubmissionId);

    const unsecuredCurrentId = await insertFeature(submissionId, uploadId, typeA);
    const supersededId = await insertFeature(submissionId, uploadId, typeA);
    const noSelfLoopId = await insertFeature(submissionId, uploadId, typeB);
    const securedNotGrantedId = await insertFeature(submissionId, uploadId, typeB);
    const securedGrantedId = await insertFeature(grantedSubmissionId, grantedUploadId, typeB);

    const extraTypeAIds: number[] = [];
    const extraTypeBIds: number[] = [];
    if (options.extraFeatures) {
      // Interleave the types so ascending id order is not the same as "type A, then type B".
      extraTypeBIds.push(await insertFeature(submissionId, uploadId, typeB));
      extraTypeAIds.push(await insertFeature(submissionId, uploadId, typeA));
      extraTypeBIds.push(await insertFeature(submissionId, uploadId, typeB));
      extraTypeAIds.push(await insertFeature(submissionId, uploadId, typeA));
    }

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
      `version-features-test-team-${randomUUID()}`
    );

    const policyId = await createPolicy(connection, `Version features policy ${randomUUID()}`);
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
      securedNotGrantedId,
      extraTypeAIds,
      extraTypeBIds
    };

    // Fixture checks: the download is the user's, its policy covers the two types only, and the
    // expression selects the expected features before anything is built.
    expect(source.requested_by, 'source.requested_by').to.equal(requestedBy);
    expect(
      statements.map((statement) => statement.urn_feature_type),
      'feature types of the effective statements'
    ).to.have.members(featureTypeNames);
    expect(statements, 'effective statements').to.have.length(2);
    expect(await selectableNow(fixture), 'features selectable before the build').to.eql(selectedIds(fixture));

    return fixture;
  }

  /** The features the build selects: the unsecured current one, the granted secured one, and any extras. */
  function selectedIds(fixture: FeatureSetFixture): number[] {
    return sortIds([
      fixture.unsecuredCurrentId,
      fixture.securedGrantedId,
      ...fixture.extraTypeAIds,
      ...fixture.extraTypeBIds
    ]);
  }

  /**
   * Write one Parquet file per statement with the Parquet writer and the upload stubbed, and return
   * the features of the rows the files received, ascending. A row is mapped to its feature through
   * its `uuid`.
   */
  async function writeFilesAndCaptureFeatureIds(fixture: FeatureSetFixture): Promise<number[]> {
    let currentRows: Record<string, unknown>[] = [];
    const writer = sinon.createStubInstance(parquetjs.ParquetWriter);
    writer.appendRow.callsFake(async (row: Record<string, unknown>) => {
      currentRows.push(row);
    });
    writer.close.resolves();
    sinon.stub(parquetjs.ParquetWriter, 'openStream').resolves(writer);
    sinon.stub(ObjectStorageService.prototype, 'uploadStream').resolves();

    const featureIds: number[] = [];
    for (const statement of fixture.statements) {
      currentRows = [];
      const featureTypeName = statement.urn_feature_type;
      await pipelineService.writeFeatureTypeParquet({
        downloadId: fixture.downloadId,
        downloadVersionId: fixture.downloadVersionId,
        properties: fixture.schemaLookup.get(featureTypeName) ?? [],
        featureTypeName
      });

      const uuids = currentRows.map((row) => String(row.uuid));
      const features = await connection.sql(SQL`
        SELECT submission_feature_id
        FROM submission_feature
        WHERE uuid = ANY(${uuids}::uuid[]);
      `);
      expect(features.rows, `features behind the rows of the ${featureTypeName} file`).to.have.length(uuids.length);
      featureIds.push(...features.rows.map((row) => row.submission_feature_id));
    }

    return sortIds(featureIds);
  }

  async function markReady(downloadVersionId: string, featureCount: number): Promise<void> {
    await pipelineService.transitionDownloadVersionStatus(downloadVersionId, DownloadStatusEnum.PROCESSING, [
      DownloadStatusEnum.PENDING
    ]);
    await pipelineService.transitionDownloadVersionStatus(
      downloadVersionId,
      DownloadStatusEnum.READY,
      [DownloadStatusEnum.PROCESSING],
      { featureCount }
    );
  }

  /**
   * Build the fixture's version the way the job does: store the set, write the files from it, move
   * the version to `ready` with its count. Returns the features captured from the files, ascending.
   */
  async function buildVersion(fixture: FeatureSetFixture): Promise<number[]> {
    const featureCount = await pipelineService.storeDownloadVersionFeatureSet({
      downloadVersionId: fixture.downloadVersionId,
      source: fixture.source,
      statements: fixture.statements
    });
    const fileFeatureIds = await writeFilesAndCaptureFeatureIds(fixture);
    await markReady(fixture.downloadVersionId, featureCount);

    // Fixture check: the files hold the selected features, and the count is their number.
    expect(fileFeatureIds, 'features in the captured files').to.eql(selectedIds(fixture));
    expect(featureCount, 'storeDownloadVersionFeatureSet return value').to.equal(fileFeatureIds.length);

    return fileFeatureIds;
  }

  /** Page through the list with the given limit until a page comes back empty; returns every page. */
  async function listAllPages(downloadId: string, downloadVersionId: string, limit: number): Promise<FeaturePage[]> {
    const pages: FeaturePage[] = [];
    for (let page = 1; page <= 50; page++) {
      const result: FeaturePage = await downloadService.listDownloadVersionFeatures(downloadId, downloadVersionId, {
        page,
        limit
      });
      pages.push(result);
      if (result.features.length === 0) {
        return pages;
      }
    }

    throw new Error('listDownloadVersionFeatures never returned an empty page');
  }

  function listedIds(pages: FeaturePage[]): number[] {
    return pages.flatMap((page) => page.features.map((feature) => feature.submission_feature_id));
  }

  async function readStoredSet(
    downloadVersionId: string
  ): Promise<{ ids: number[] | null; featureCount: number | null; isNull: boolean }> {
    const result = await connection.sql(SQL`
      SELECT
        rb_to_array(feature_ids) AS ids,
        feature_count,
        feature_ids IS NULL AS is_null
      FROM download_version
      WHERE download_version_id = ${downloadVersionId};
    `);

    expect(result.rows, 'download_version row').to.have.length(1);

    return {
      ids: result.rows[0].ids,
      featureCount: result.rows[0].feature_count,
      isNull: result.rows[0].is_null
    };
  }

  /** Supersede a feature the way a newer upload does: point it at a successor and end it. */
  async function supersedeFeature(submissionFeatureId: number, successorId: number): Promise<void> {
    await connection.sql(SQL`
      UPDATE submission_feature
      SET successor_submission_feature_id = ${successorId},
          record_end_date = now()
      WHERE submission_feature_id = ${submissionFeatureId};
    `);
  }

  /** A download with no fixture features behind it, and its (pending) version. */
  async function createPlainDownload(): Promise<{ download_id: string; download_version_id: string }> {
    const { policy_id } = await policyService.createDownloadPolicy({
      name: `Version features plain policy ${randomUUID()}`,
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

  // ── AC4 ──────────────────────────────────────────────────────────────

  it('AC4 pages of two, concatenated, are exactly the features in the files, each once, in ascending id, with the set size as count and is_snapshot true', async () => {
    const fixture = await createFixture({ extraFeatures: true });
    const fileFeatureIds = await buildVersion(fixture);
    expect(fileFeatureIds.length, 'features in the stored set').to.be.at.least(5);

    const pages = await listAllPages(fixture.downloadId, fixture.downloadVersionId, 2);

    expect(listedIds(pages), 'submission_feature_id of the listed features, in page order').to.eql(fileFeatureIds);

    // Six features at two per page: three full pages, then the empty one.
    expect(
      pages.map((page) => page.features.length),
      'page sizes'
    ).to.eql([2, 2, 2, 0]);
    for (const [index, page] of pages.entries()) {
      expect(page.count, `count on page ${index + 1}`).to.equal(fileFeatureIds.length);
      expect(page.is_snapshot, `is_snapshot on page ${index + 1}`).to.equal(true);
    }
  });

  it('AC4 each listed item carries the submission_feature_id, uuid, submission_id, feature_type_id and feature_type_name of its feature', async () => {
    const fixture = await createFixture({ extraFeatures: true });
    const fileFeatureIds = await buildVersion(fixture);

    const pages = await listAllPages(fixture.downloadId, fixture.downloadVersionId, 2);
    const listed = pages.flatMap((page) => page.features);

    const expected = await connection.sql(SQL`
      SELECT
        sf.submission_feature_id,
        sf.uuid,
        sf.submission_id,
        sf.feature_type_id,
        ft.name AS feature_type_name
      FROM submission_feature sf
      JOIN feature_type ft ON ft.feature_type_id = sf.feature_type_id
      WHERE sf.submission_feature_id = ANY(${fileFeatureIds}::integer[])
      ORDER BY sf.submission_feature_id;
    `);

    expect(listed, 'listed features').to.have.length(fileFeatureIds.length);
    for (const [index, row] of expected.rows.entries()) {
      expect(listed[index], `listed feature ${index}`).to.include({
        submission_feature_id: row.submission_feature_id,
        uuid: row.uuid,
        submission_id: row.submission_id,
        feature_type_id: row.feature_type_id,
        feature_type_name: row.feature_type_name
      });
    }

    // The list covers both of the download's feature types.
    expect(
      Array.from(new Set(listed.map((feature) => feature.feature_type_name))),
      'feature types of the listed features'
    ).to.have.members(fixture.featureTypeNames);
  });

  // ── AC5 ──────────────────────────────────────────────────────────────

  it('AC5 a feature superseded after the build and a feature whose closure rows were deleted are both still listed, and count is unchanged', async () => {
    const fixture = await createFixture({ extraFeatures: true });
    const fileFeatureIds = await buildVersion(fixture);
    const supersededAfterBuildId = fixture.extraTypeAIds[0];
    const closureDeletedId = fixture.extraTypeBIds[0];

    const before = await listAllPages(fixture.downloadId, fixture.downloadVersionId, 2);
    expect(listedIds(before), 'features listed right after the build').to.include.members([
      supersededAfterBuildId,
      closureDeletedId
    ]);

    await supersedeFeature(supersededAfterBuildId, fixture.unsecuredCurrentId);
    await connection.sql(SQL`
      DELETE FROM submission_feature_closure
      WHERE source_submission_feature_id = ${closureDeletedId}
        OR target_submission_feature_id = ${closureDeletedId};
    `);

    // Fixture checks: the closure rows are gone, and the expression no longer selects either feature.
    expect(await countClosureRows(closureDeletedId), 'closure rows of the feature').to.equal(0);
    const selectable = await selectableNow(fixture);
    expect(selectable, 'features selectable after the changes').to.not.include(supersededAfterBuildId);
    expect(selectable, 'features selectable after the changes').to.not.include(closureDeletedId);

    const after = await listAllPages(fixture.downloadId, fixture.downloadVersionId, 2);

    expect(listedIds(after), 'features listed after the changes').to.include(supersededAfterBuildId);
    expect(listedIds(after), 'features listed after the changes').to.include(closureDeletedId);
    expect(listedIds(after), 'features listed after the changes').to.eql(fileFeatureIds);
    for (const [index, page] of after.entries()) {
      expect(page.count, `count on page ${index + 1} after the changes`).to.equal(before[0].count);
      expect(page.count, `count on page ${index + 1} after the changes`).to.equal(fileFeatureIds.length);
    }
  });

  // ── AC6 ──────────────────────────────────────────────────────────────

  it('AC6 rb_to_array(feature_ids), feature_count and the full list are the same after one feature is superseded and another is secured', async () => {
    const fixture = await createFixture({ extraFeatures: true });
    const fileFeatureIds = await buildVersion(fixture);
    const supersededAfterBuildId = fixture.extraTypeBIds[1];
    const securedAfterBuildId = fixture.unsecuredCurrentId;

    const storedBefore = await readStoredSet(fixture.downloadVersionId);
    const pagesBefore = await listAllPages(fixture.downloadId, fixture.downloadVersionId, 2);

    // Right after the build: the set is the files' features and the count is its size.
    expect(storedBefore.ids, 'rb_to_array(feature_ids) after the build').to.eql(fileFeatureIds);
    expect(storedBefore.featureCount, 'feature_count after the build').to.equal(fileFeatureIds.length);
    expect(listedIds(pagesBefore), 'features listed after the build').to.eql(fileFeatureIds);

    await supersedeFeature(supersededAfterBuildId, fixture.extraTypeBIds[0]);
    // The requesting user has no grant for this feature's submission, so securing it hides it.
    await secureFeature(connection, securedAfterBuildId);

    // Fixture check: the expression no longer selects either feature.
    const selectable = await selectableNow(fixture);
    expect(selectable, 'features selectable after the changes').to.not.include(supersededAfterBuildId);
    expect(selectable, 'features selectable after the changes').to.not.include(securedAfterBuildId);

    const storedAfter = await readStoredSet(fixture.downloadVersionId);
    const pagesAfter = await listAllPages(fixture.downloadId, fixture.downloadVersionId, 2);

    expect(storedAfter.ids, 'rb_to_array(feature_ids) after the changes').to.eql(storedBefore.ids);
    expect(storedAfter.featureCount, 'feature_count after the changes').to.equal(storedBefore.featureCount);
    expect(pagesAfter, 'every page of the list after the changes').to.eql(pagesBefore);
  });

  // ── AC8 ──────────────────────────────────────────────────────────────

  it('AC8 a ready version with NULL feature_ids lists exactly the unsecured current feature and the granted secured feature, with a matching count and is_snapshot false', async () => {
    const fixture = await createFixture({ extraFeatures: false });
    // A version built before the change: ready, with a count, and no stored set.
    await markReady(fixture.downloadVersionId, 2);
    const stored = await readStoredSet(fixture.downloadVersionId);
    expect(stored.isNull, 'feature_ids IS NULL').to.equal(true);

    const pages = await listAllPages(fixture.downloadId, fixture.downloadVersionId, 1);

    const expectedIds = sortIds([fixture.unsecuredCurrentId, fixture.securedGrantedId]);
    expect(listedIds(pages), 'features listed for the version with no stored set').to.eql(expectedIds);
    expect(listedIds(pages)).to.not.include(fixture.supersededId);
    expect(listedIds(pages)).to.not.include(fixture.noSelfLoopId);
    expect(listedIds(pages)).to.not.include(fixture.securedNotGrantedId);
    for (const [index, page] of pages.entries()) {
      expect(page.count, `count on page ${index + 1}`).to.equal(2);
      expect(page.is_snapshot, `is_snapshot on page ${index + 1}`).to.equal(false);
    }

    // Still NULL: reading the list stores nothing on the version.
    expect((await readStoredSet(fixture.downloadVersionId)).isNull, 'feature_ids IS NULL after the read').to.equal(
      true
    );
  });

  it('AC8 a ready version with a stored set reports is_snapshot true', async () => {
    const fixture = await createFixture({ extraFeatures: false });
    const fileFeatureIds = await buildVersion(fixture);

    const pages = await listAllPages(fixture.downloadId, fixture.downloadVersionId, 1);

    expect(listedIds(pages), 'features listed for the version with a stored set').to.eql(fileFeatureIds);
    for (const [index, page] of pages.entries()) {
      expect(page.is_snapshot, `is_snapshot on page ${index + 1}`).to.equal(true);
    }
  });

  it('AC8 a version that is not ready is refused with HTTP409', async () => {
    const fixture = await createFixture({ extraFeatures: false });
    // The set is stored but the version is still processing.
    await pipelineService.storeDownloadVersionFeatureSet({
      downloadVersionId: fixture.downloadVersionId,
      source: fixture.source,
      statements: fixture.statements
    });
    await pipelineService.transitionDownloadVersionStatus(fixture.downloadVersionId, DownloadStatusEnum.PROCESSING, [
      DownloadStatusEnum.PENDING
    ]);

    let caught: unknown;
    try {
      await downloadService.listDownloadVersionFeatures(fixture.downloadId, fixture.downloadVersionId, {
        page: 1,
        limit: 2
      });
    } catch (error) {
      caught = error;
    }

    expect(caught, 'error for a processing version').to.be.instanceOf(HTTP409);
  });

  it('AC8 a downloadVersionId that belongs to another download is a 404', async () => {
    const fixture = await createFixture({ extraFeatures: false });
    await buildVersion(fixture);
    const other = await createPlainDownload();

    let caught: unknown;
    try {
      // The version is ready and has a set, so the only thing wrong is the download it is asked under.
      await downloadService.listDownloadVersionFeatures(other.download_id, fixture.downloadVersionId, {
        page: 1,
        limit: 2
      });
    } catch (error) {
      caught = error;
    }

    expect(caught, 'error for a version of another download').to.be.instanceOf(Error);
    expect(ensureHTTPError(caught).status, 'HTTP status').to.equal(404);
  });

  // ── AC9 ──────────────────────────────────────────────────────────────

  describe('AC9 callers the Download authorization admits', () => {
    it('AC9 no user and a download with no team: allowed', async () => {
      const { download_id } = await createPlainDownload();

      expect(await downloadService.isUserAuthorizedForDownload(download_id, null)).to.equal(true);
    });

    it('AC9 no user and a download linked to a team: refused', async () => {
      const { download_id } = await createPlainDownload();
      const member = await createUser();
      await downloadService.linkDownloadToNewTeam(
        download_id,
        member,
        'Version features team',
        'Version features team'
      );

      expect(await downloadService.isUserAuthorizedForDownload(download_id, null)).to.equal(false);
    });

    it('AC9 a member of the linked team: allowed', async () => {
      const { download_id } = await createPlainDownload();
      const member = await createUser();
      await downloadService.linkDownloadToNewTeam(
        download_id,
        member,
        'Version features team',
        'Version features team'
      );

      expect(await downloadService.isUserAuthorizedForDownload(download_id, member)).to.equal(true);
    });

    it('AC9 a signed-in user who is not a member of the linked team: refused', async () => {
      const { download_id } = await createPlainDownload();
      const member = await createUser();
      const nonMember = await createUser();
      await downloadService.linkDownloadToNewTeam(
        download_id,
        member,
        'Version features team',
        'Version features team'
      );

      expect(await downloadService.isUserAuthorizedForDownload(download_id, nonMember)).to.equal(false);
    });
  });
});
