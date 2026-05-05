// System integration tests for the download pipeline. Requires MinIO (S3) to be running.
// Worker test: publish job → worker picks up → per-feature-type .parquet files → S3 → download_status = ready.
//
// Run: make test-sys
// Requires: make web (database + MinIO must be running)

import { ParquetReader } from '@dsnp/parquetjs';
import { expect } from 'chai';
import { Knex, knex } from 'knex';
import { createHash, randomUUID } from 'node:crypto';
import { initPgBoss, stopPgBoss } from '../../queue/pg-boss-service';
import { BucketType, ObjectStorageService } from '../../services/object-storage/object-storage-service';
import { getOrCreateTestTicketId } from '../helpers/test-ticket-helpers';

const TEST_PREFIX = 'dev-artifacts';
const SYSTEM_USER_ID = 1;

/** Download a Parquet file from S3 and return its raw bytes. */
async function downloadParquetFromS3(storageService: ObjectStorageService, s3Key: string): Promise<Buffer> {
  const fileStream = await storageService.getFileStream(BucketType.MAIN, s3Key);
  const chunks: Buffer[] = [];
  for await (const chunk of fileStream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * Poll the download table until the status matches the target or times out.
 */
async function waitForDownloadStatus(
  db: Knex,
  downloadId: number,
  targetStatus: string,
  timeoutMs = 45000
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const [row] = await db('biohub.download').where('download_id', downloadId).select('download_status');

    if (row?.download_status === targetStatus) {
      return;
    }

    if (row?.download_status === 'failed') {
      const [detail] = await db('biohub.download').where('download_id', downloadId).select('metadata');
      throw new Error(`Download ${downloadId} failed: ${JSON.stringify(detail?.metadata)}`);
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  throw new Error(`Timeout waiting for download ${downloadId} to reach status '${targetStatus}'`);
}

describe('Download Worker', function () {
  this.timeout(60000);

  let db: Knex;
  let storageService: ObjectStorageService;
  const createdDownloadIds: number[] = [];
  const createdPolicyIds: string[] = [];
  const createdPolicyStatementIds: string[] = [];
  const createdSubmissionFeatureIds: number[] = [];
  const createdSubmissionUploadIds: string[] = [];
  const createdSubmissionIds: number[] = [];
  const createdUploadIds: string[] = [];
  const createdTicketIds: string[] = [];
  const createdS3Keys: string[] = [];
  const createdArtifactIds: string[] = [];

  before(async () => {
    db = knex({
      client: 'pg',
      connection: {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        database: process.env.DB_DATABASE,
        user: process.env.DB_USER_API,
        password: process.env.DB_USER_API_PASS
      },
      searchPath: ['biohub', 'public']
    });

    storageService = new ObjectStorageService();
    await initPgBoss();
  });

  after(async () => {
    // Cleanup in reverse dependency order
    try {
      // 1. Delete artifacts created by the worker (tracked by FK on download_artifact,
      //    not in createdArtifactIds). Must run BEFORE the download delete so we can
      //    still JOIN on download_id.
      if (createdDownloadIds.length > 0) {
        const workerArtifactIds = await db('biohub.download_artifact')
          .whereIn('download_id', createdDownloadIds)
          .pluck('artifact_id');
        if (workerArtifactIds.length > 0) {
          await db('biohub.download_artifact').whereIn('download_id', createdDownloadIds).del();
          await db('biohub.artifact').whereIn('artifact_id', workerArtifactIds).del();
        }
        await db('biohub.download_team').whereIn('download_id', createdDownloadIds).del();
        await db('biohub.download').whereIn('download_id', createdDownloadIds).del();
      }

      // 1b. Delete policy_statement_expression (no statements should have any here, but be defensive),
      //     then policy_statement, then the owning policies — children first to satisfy FK.
      if (createdPolicyStatementIds.length > 0) {
        await db('biohub.policy_statement_expression')
          .whereIn('policy_statement_id', createdPolicyStatementIds)
          .del();
        await db('biohub.policy_statement').whereIn('policy_statement_id', createdPolicyStatementIds).del();
      }
      if (createdPolicyIds.length > 0) {
        await db('biohub.policy').whereIn('policy_id', createdPolicyIds).del();
      }

      // 2. Delete submission features
      if (createdSubmissionFeatureIds.length > 0) {
        await db('biohub.submission_feature').whereIn('submission_feature_id', createdSubmissionFeatureIds).del();
      }

      // 2b. Delete submission upload bridge rows and uploads
      if (createdSubmissionUploadIds.length > 0) {
        await db('biohub.submission_upload_status').whereIn('submission_upload_id', createdSubmissionUploadIds).del();
        await db('biohub.submission_upload').whereIn('submission_upload_id', createdSubmissionUploadIds).del();
      }

      if (createdUploadIds.length > 0) {
        await db('biohub.upload').whereIn('upload_id', createdUploadIds).del();
      }

      // 2c. Delete artifact records
      if (createdArtifactIds.length > 0) {
        await db('biohub.artifact').whereIn('artifact_id', createdArtifactIds).del();
      }

      // 3. Delete submissions
      if (createdSubmissionIds.length > 0) {
        await db('biohub.submission').whereIn('submission_id', createdSubmissionIds).del();
      }

      if (createdTicketIds.length > 0) {
        await db('biohub.ticket_status').whereIn('ticket_id', createdTicketIds).del();
        await db('biohub.ticket').whereIn('ticket_id', createdTicketIds).del();
      }

      // 4. Delete S3 objects
      for (const key of createdS3Keys) {
        try {
          await storageService.deleteFile(BucketType.MAIN, key);
        } catch {
          /* may not exist */
        }
      }
    } catch (error_) {
      console.warn('Cleanup failed:', error_);
    }

    await stopPgBoss();
    await db.destroy();
  });

  /**
   * Insert a test submission and return its ID. Tracked for cleanup.
   */
  async function createTestSubmission(): Promise<number> {
    const [row] = await db('biohub.submission')
      .insert({
        uuid: db.raw('gen_random_uuid()'),
        system_user_id: SYSTEM_USER_ID,
        contributor_id: 1,
        name: `${TEST_PREFIX} Download Integration Test`,
        description: 'Test submission for download worker integration test',
        comment: 'Integration test',
        create_user: SYSTEM_USER_ID
      })
      .returning('submission_id');

    createdSubmissionIds.push(row.submission_id);
    return row.submission_id;
  }

  /**
   * Insert a test submission_feature and return its ID. Tracked for cleanup.
   */
  async function createTestFeature(
    submissionId: number,
    featureTypeName: string,
    data: Record<string, unknown>,
    parentFeatureId?: number
  ): Promise<number> {
    const featureType = await db('biohub.feature_type').where('name', featureTypeName).first();
    if (!featureType) {
      throw new Error(`Feature type '${featureTypeName}' not found in seed data`);
    }

    const dataJson = JSON.stringify(data);

    const [upload] = await db('biohub.upload')
      .insert({
        upload_status: 'completed',
        record_end_date: db.fn.now(),
        create_user: SYSTEM_USER_ID
      })
      .returning('upload_id');
    createdUploadIds.push(upload.upload_id);

    const ticketId = await getOrCreateTestTicketId(db, submissionId, upload.upload_id, SYSTEM_USER_ID);

    const [bridge] = await db('biohub.submission_upload')
      .insert({
        submission_id: submissionId,
        upload_id: upload.upload_id,
        ticket_id: ticketId,
        create_user: SYSTEM_USER_ID
      })
      .returning('submission_upload_id');
    createdSubmissionUploadIds.push(bridge.submission_upload_id);

    const [row] = await db('biohub.submission_feature')
      .insert({
        submission_id: submissionId,
        feature_type_id: featureType.feature_type_id,
        parent_submission_feature_id: parentFeatureId ?? null,
        data: dataJson,
        data_byte_size: db.raw(`octet_length(?::jsonb::text) + 500`, [dataJson]),
        submission_upload_id: bridge.submission_upload_id,
        create_user: SYSTEM_USER_ID
      })
      .returning('submission_feature_id');

    createdSubmissionFeatureIds.push(row.submission_feature_id);
    return row.submission_feature_id;
  }

  /**
   * Create a policy-backed download, publish the job to pg-boss, and wait for completion.
   *
   * Features are resolved at pipeline time by evaluating each `policy_statement` against
   * the database. With `expression_id IS NULL` the broad path picks every active feature
   * of the named type — same selection model as the route handler.
   *
   * The worker is the single owner of artifact writes — for parquet it creates one
   * `artifact` + `download_artifact` pair per feature type at write-time with the real
   * checksum + byte size. No request-time stub artifacts are created here.
   */
  async function createDownloadAndProcess(
    featureTypeNames: string[],
    downloadOverrides?: Record<string, unknown>
  ): Promise<{ downloadId: number }> {
    // Create the owning policy (status='approved' so the row is treated as live).
    const [policy] = await db('biohub.policy')
      .insert({
        name: `${TEST_PREFIX} download policy ${Date.now()}-${randomUUID().slice(0, 8)}`,
        description: 'Integration test policy',
        status: 'approved',
        create_user: SYSTEM_USER_ID
      })
      .returning('policy_id');
    createdPolicyIds.push(policy.policy_id);

    // One ALLOW statement per feature type — the broad-path projection at write-time
    // picks every active submission_feature of the type for the policy creator's
    // visibility scope.
    for (const featureTypeName of featureTypeNames) {
      const [statement] = await db('biohub.policy_statement')
        .insert({
          policy_id: policy.policy_id,
          effect: 'allow',
          submission_feature_urn: `urn:*:${featureTypeName}:*`,
          create_user: SYSTEM_USER_ID
        })
        .returning('policy_statement_id');
      createdPolicyStatementIds.push(statement.policy_statement_id);
    }

    const format = (downloadOverrides?.format as string) ?? 'csv';

    const [download] = await db('biohub.download')
      .insert({
        download_status: 'pending',
        policy_id: policy.policy_id,
        format,
        create_user: SYSTEM_USER_ID,
        ...downloadOverrides
      })
      .returning('download_id');
    createdDownloadIds.push(download.download_id);

    const boss = await initPgBoss();
    await boss.createQueue('process-download');
    const jobId = await boss.send('process-download', {
      downloadId: download.download_id,
      teamId: null
    });
    expect(jobId).to.be.a('string');

    await waitForDownloadStatus(db, download.download_id, 'ready');

    return { downloadId: download.download_id };
  }

  /**
   * Upload a buffer to S3, insert the matching artifact row, and create a `file` feature
   * whose `artifact_key` points at the uploaded object. Tracks s3 key + artifact id for cleanup.
   */
  async function seedFileFeatureWithArtifact(
    submissionId: number,
    datasetFeatureId: number,
    opts: { keyPrefix: string; bufferContent: string; filename: string }
  ): Promise<{ fileFeatureId: number; artifactSourceKey: string }> {
    const artifactSourceKey = `${TEST_PREFIX}/${opts.keyPrefix}-${Date.now()}.bin`;
    const artifactSourceBytes = Buffer.from(opts.bufferContent);
    await storageService.uploadBuffer(
      BucketType.MAIN,
      artifactSourceBytes,
      'application/octet-stream',
      artifactSourceKey
    );
    createdS3Keys.push(artifactSourceKey);

    const bucketName = process.env.OBJECT_STORE_BUCKET_NAME!;
    const [sourceArtifact] = await db('biohub.artifact')
      .insert({
        bucket: bucketName,
        object_key: artifactSourceKey,
        byte_size: artifactSourceBytes.length,
        artifact_status: 'uploaded',
        uploaded_at: new Date().toISOString(),
        format: 'tar',
        create_user: SYSTEM_USER_ID
      })
      .returning('artifact_id');
    createdArtifactIds.push(sourceArtifact.artifact_id);

    // For Parquet, hydrateFeatureBatch reads artifact_key from `data.properties.artifact_key`
    // (see download-pipeline-service.ts:512). Seed in that shape.
    const fileFeatureId = await createTestFeature(
      submissionId,
      'file',
      { properties: { artifact_key: artifactSourceKey, filename: opts.filename } },
      datasetFeatureId
    );

    return { fileFeatureId, artifactSourceKey };
  }

  it('should process a parquet download job and upload per-type files to S3', async () => {
    // 1. Create test data covering all three axes:
    //    - dataset: spatial (has geometry)
    //    - sample_site: spatial (has geometry)
    //    - file: non-spatial, artifact_key-bearing
    const submissionId = await createTestSubmission();

    const datasetFeatureId = await createTestFeature(submissionId, 'dataset', {
      name: 'Parquet Integration Test Dataset',
      start_date: '2024-01-01T00:00:00.000Z',
      end_date: '2024-12-31T00:00:00.000Z',
      geometry: { type: 'Point', coordinates: [-124.856, 54.321] }
    });

    const sampleSiteFeatureId = await createTestFeature(
      submissionId,
      'sample_site',
      {
        name: 'Parquet Test Site',
        description: 'Integration test sample site',
        geometry: { type: 'Point', coordinates: [-130.849, 56.207] }
      },
      datasetFeatureId
    );

    // Seed an S3-backed artifact + `file` feature so the Parquet file includes an
    // artifact_key column with a real round-trippable value.
    const { fileFeatureId, artifactSourceKey } = await seedFileFeatureWithArtifact(submissionId, datasetFeatureId, {
      keyPrefix: 'parquet-test-file',
      bufferContent: 'source-file-content-for-parquet-round-trip',
      filename: 'parquet-test.bin'
    });

    // Fetch the uuid for each feature for row-level assertions below
    const featureUuidRows = await db('biohub.submission_feature')
      .whereIn('submission_feature_id', [datasetFeatureId, sampleSiteFeatureId, fileFeatureId])
      .select('submission_feature_id', 'uuid');
    const uuidBySubmissionFeatureId = new Map<number, string>(
      featureUuidRows.map((r: any) => [r.submission_feature_id, r.uuid])
    );
    const datasetUuid = uuidBySubmissionFeatureId.get(datasetFeatureId)!;
    const sampleSiteUuid = uuidBySubmissionFeatureId.get(sampleSiteFeatureId)!;
    const fileUuid = uuidBySubmissionFeatureId.get(fileFeatureId)!;

    // 2. Create parquet download, publish job, and wait for completion
    // The policy projects every active feature of the named types — a single test
    // submission owns the only matching rows, so the broad path returns exactly the
    // features seeded above.
    const { downloadId } = await createDownloadAndProcess(['dataset', 'sample_site', 'file'], {
      format: 'parquet'
    });
    // featureIds remain useful breadcrumbs in failure messages.
    expect(datasetFeatureId).to.be.a('number');
    expect(sampleSiteFeatureId).to.be.a('number');
    expect(fileFeatureId).to.be.a('number');

    // 3. Verify download status transitions completed
    const [finalDownload] = await db('biohub.download').where('download_id', downloadId).select('*');
    expect(finalDownload.download_status).to.equal('ready');
    expect(finalDownload.format).to.equal('parquet');
    expect(finalDownload.completed_at).to.not.be.null;

    // 4. List S3 keys under downloads/{downloadId}/ and assert the exact key set
    const datasetKey = `downloads/${downloadId}/dataset/data.parquet`;
    const sampleSiteKey = `downloads/${downloadId}/sample_site/data.parquet`;
    const fileKey = `downloads/${downloadId}/file/data.parquet`;
    // Track all per-type parquet keys for cleanup (belt + suspenders alongside
    // the download_id-JOIN cleanup path in after()).
    createdS3Keys.push(datasetKey, sampleSiteKey, fileKey);

    const s3List = await storageService.listFiles(BucketType.MAIN, `downloads/${downloadId}/`);
    const s3Keys = new Set((s3List.Contents ?? []).map((o) => o.Key!));
    expect(s3Keys).to.deep.equal(new Set([datasetKey, sampleSiteKey, fileKey]));

    // 5. Row counts: exactly 3 artifact + 3 download_artifact rows for this download
    const artifactRows = await db('biohub.artifact')
      .join('biohub.download_artifact', 'biohub.download_artifact.artifact_id', 'biohub.artifact.artifact_id')
      .where('download_artifact.download_id', downloadId)
      .whereNull('download_artifact.record_end_date')
      .select(
        'biohub.artifact.artifact_id',
        'biohub.artifact.object_key',
        'biohub.artifact.byte_size',
        'biohub.artifact.uploaded_at',
        'biohub.artifact.artifact_status',
        'biohub.artifact.checksum_sha256'
      )
      .orderBy('biohub.artifact.object_key');
    expect(artifactRows).to.have.lengthOf(3);

    const downloadArtifactRows = await db('biohub.download_artifact')
      .where('download_id', downloadId)
      .whereNull('record_end_date')
      .select('*');
    expect(downloadArtifactRows).to.have.lengthOf(3);

    const artifactByKey = new Map<string, (typeof artifactRows)[number]>(
      artifactRows.map((r: any) => [r.object_key, r])
    );

    // 6. Per-file round-trip: byte_size + checksum + ParquetReader schema + rows + geo metadata
    for (const s3Key of [datasetKey, sampleSiteKey, fileKey]) {
      const row = artifactByKey.get(s3Key);
      expect(row, `artifact row for ${s3Key}`).to.not.be.undefined;

      const buffer = await downloadParquetFromS3(storageService, s3Key);

      // byte_size == downloaded length
      expect(Number(row!.byte_size)).to.equal(buffer.length);
      // uploaded metadata set
      expect(row!.uploaded_at).to.not.be.null;
      expect(row!.artifact_status).to.equal('uploaded');
      // Stored checksum matches a re-hash of the bytes we just downloaded
      const rehash = createHash('sha256').update(buffer).digest('hex');
      expect(rehash).to.equal(row!.checksum_sha256);

      // ParquetReader schema + rows
      const reader = await ParquetReader.openBuffer(buffer);
      try {
        const schema = reader.getSchema();
        const fields = schema.fields as Record<string, any>;
        expect(fields).to.have.property('uuid');
        expect(fields).to.have.property('parent_uuid');
        // uuid is required (REPEATED/OPTIONAL excluded), parent_uuid is optional.
        // @dsnp/parquetjs exposes this as `repetitionType`, not a boolean `optional`.
        expect(fields.uuid.repetitionType).to.equal('REQUIRED');
        expect(fields.parent_uuid.repetitionType).to.equal('OPTIONAL');
        expect(fields.uuid.originalType).to.equal('UTF8');
        expect(fields.parent_uuid.originalType).to.equal('UTF8');

        // Collect rows
        const cursor = reader.getCursor();
        const rows: any[] = [];
        let next: any;
        while ((next = await cursor.next())) {
          rows.push(next);
        }
        expect(rows).to.have.lengthOf(1);

        // GeoParquet metadata + row assertions per feature type. Spatial types carry
        // a `geo` key in the Parquet footer per GeoParquet 1.0; non-spatial types must not.
        const kvMetadata = (reader.metadata as any)?.key_value_metadata ?? [];
        const geoEntry = kvMetadata.find((kv: any) => kv.key === 'geo');

        const expectGeoShape = () => {
          expect(geoEntry, 'spatial type must carry geo metadata').to.exist;
          const geo = JSON.parse(geoEntry.value);
          expect(geo.version).to.equal('1.0.0');
          expect(geo.primary_column).to.equal('geometry');
          expect(geo.columns.geometry.encoding).to.equal('WKB');
          expect(geo.columns.geometry.crs.id.code).to.equal(4326);
        };

        // Per seed data: sample_site.geometry is feature_property_type_name='spatial',
        // dataset has no spatial-typed property. The `geo` footer key follows the producer's
        // spatial-column detection, so only sample_site carries it.
        if (s3Key === sampleSiteKey) {
          expect(rows[0].uuid).to.equal(sampleSiteUuid);
          expectGeoShape();
        } else if (s3Key === datasetKey) {
          expect(rows[0].uuid).to.equal(datasetUuid);
          expect(geoEntry, 'dataset has no spatial-typed property, must NOT carry geo metadata').to.be.undefined;
        } else {
          // file (non-spatial + artifact_key) — must NOT carry geo metadata.
          expect(rows[0].uuid).to.equal(fileUuid);
          expect(geoEntry, 'file should NOT have geo metadata').to.be.undefined;
          // artifact_key column round-trip — parquet UTF8 strings come back as Buffers
          const rawArtifactKey = rows[0].artifact_key;
          const stringified = Buffer.isBuffer(rawArtifactKey) ? rawArtifactKey.toString('utf-8') : rawArtifactKey;
          expect(stringified).to.equal(artifactSourceKey);
        }
      } finally {
        await reader.close();
      }
    }
  });

  it('should be idempotent on retry — re-running the pipeline does not create duplicate rows or S3 objects', async () => {
    // Same fixture shape as the extended parquet test: dataset + sample_site + file (artifact_key).
    const submissionId = await createTestSubmission();

    const datasetFeatureId = await createTestFeature(submissionId, 'dataset', {
      name: 'Parquet Retry Test Dataset',
      start_date: '2024-01-01T00:00:00.000Z',
      end_date: '2024-12-31T00:00:00.000Z',
      geometry: { type: 'Point', coordinates: [-124.856, 54.321] }
    });
    const sampleSiteFeatureId = await createTestFeature(
      submissionId,
      'sample_site',
      {
        name: 'Parquet Retry Test Site',
        description: 'Retry test sample site',
        geometry: { type: 'Point', coordinates: [-130.849, 56.207] }
      },
      datasetFeatureId
    );

    const { fileFeatureId } = await seedFileFeatureWithArtifact(submissionId, datasetFeatureId, {
      keyPrefix: 'parquet-retry-file',
      bufferContent: 'retry-test-source-file-content',
      filename: 'retry.bin'
    });

    // Run 1
    // The policy projects every active feature of the named types — a single test
    // submission owns the only matching rows, so the broad path returns exactly the
    // features seeded above.
    const { downloadId } = await createDownloadAndProcess(['dataset', 'sample_site', 'file'], {
      format: 'parquet'
    });
    // featureIds remain useful breadcrumbs in failure messages.
    expect(datasetFeatureId).to.be.a('number');
    expect(sampleSiteFeatureId).to.be.a('number');
    expect(fileFeatureId).to.be.a('number');

    // Track per-type S3 keys for cleanup (same set expected after both runs)
    const run1DatasetKey = `downloads/${downloadId}/dataset/data.parquet`;
    const run1SampleSiteKey = `downloads/${downloadId}/sample_site/data.parquet`;
    const run1FileKey = `downloads/${downloadId}/file/data.parquet`;
    createdS3Keys.push(run1DatasetKey, run1SampleSiteKey, run1FileKey);

    // Capture state after run 1
    const afterRun1 = await db('biohub.artifact')
      .join('biohub.download_artifact', 'biohub.download_artifact.artifact_id', 'biohub.artifact.artifact_id')
      .where('download_artifact.download_id', downloadId)
      .whereNull('download_artifact.record_end_date')
      .select(
        'biohub.artifact.artifact_id',
        'biohub.artifact.object_key',
        'biohub.artifact.checksum_sha256',
        'biohub.artifact.byte_size'
      )
      .orderBy('biohub.artifact.object_key');
    expect(afterRun1).to.have.lengthOf(3);
    const run1Keys = new Set(afterRun1.map((r: any) => r.object_key));

    // Reset the download so the handler can legally transition pending → processing again
    await db('biohub.download').where('download_id', downloadId).update({
      download_status: 'pending',
      started_at: null,
      completed_at: null
    });

    // Re-publish and wait
    const boss = await initPgBoss();
    await boss.send('process-download', { downloadId, teamId: null });
    await waitForDownloadStatus(db, downloadId, 'ready');

    // Capture state after run 2
    const afterRun2 = await db('biohub.artifact')
      .join('biohub.download_artifact', 'biohub.download_artifact.artifact_id', 'biohub.artifact.artifact_id')
      .where('download_artifact.download_id', downloadId)
      .whereNull('download_artifact.record_end_date')
      .select(
        'biohub.artifact.artifact_id',
        'biohub.artifact.object_key',
        'biohub.artifact.checksum_sha256',
        'biohub.artifact.byte_size'
      )
      .orderBy('biohub.artifact.object_key');

    // Row count unchanged
    expect(afterRun2).to.have.lengthOf(3);

    // Same artifact_ids, object_keys, checksums, byte_sizes (ON CONFLICT DO NOTHING
    // + deterministic Parquet writer = identical state on retry).
    for (let i = 0; i < afterRun1.length; i++) {
      expect(afterRun2[i].artifact_id).to.equal(afterRun1[i].artifact_id);
      expect(afterRun2[i].object_key).to.equal(afterRun1[i].object_key);
      expect(afterRun2[i].checksum_sha256).to.equal(afterRun1[i].checksum_sha256);
      expect(String(afterRun2[i].byte_size)).to.equal(String(afterRun1[i].byte_size));
    }

    // S3 key set unchanged (same deterministic per-type keys, S3 overwrites)
    const s3List = await storageService.listFiles(BucketType.MAIN, `downloads/${downloadId}/`);
    const s3Keys = new Set((s3List.Contents ?? []).map((o) => o.Key!));
    expect(s3Keys).to.deep.equal(run1Keys);

    // Stored checksum still matches current S3 bytes
    for (const row of afterRun2) {
      const buf = await downloadParquetFromS3(storageService, row.object_key);
      const hash = createHash('sha256').update(buf).digest('hex');
      expect(hash).to.equal(row.checksum_sha256);
    }
  });
});
