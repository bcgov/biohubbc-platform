// System integration tests for the download pipeline. Requires MinIO (S3) to be running.
//
// 1. Download Worker — full flow via pg-boss (publish job → worker picks up → zip → S3 → status ready)
// 2. DownloadPipelineService planDownloadIfNeeded/processFragment/finalizeDownload — calls service methods directly to verify
//    CSV generation, zip packaging, column union, empty data, file features, and error placeholders.
//
// Run: make test-sys
// Requires: make web (database + MinIO must be running)

import AdmZip from 'adm-zip';
import { expect } from 'chai';
import { Knex, knex } from 'knex';
import { randomInt } from 'node:crypto';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { DownloadStatusEnum } from '../../models/download-status';
import { initPgBoss, stopPgBoss } from '../../queue/pg-boss-service';
import { DownloadPipelineService } from '../../services/download/download-pipeline-service';
import { DownloadService } from '../../services/download/download-service';
import { BucketType, ObjectStorageService } from '../../services/object-storage/object-storage-service';
import { createTestFeature, createTestSubmission } from '../helpers/test-submission-helpers';
import { getOrCreateTestTicketId } from '../helpers/test-ticket-helpers';

const TEST_PREFIX = 'dev-artifacts';
const SYSTEM_USER_ID = 1;

/** Parse CSV text into trimmed lines. */
function parseCsvLines(csv: string): string[] {
  return csv.trim().split('\n');
}

/** Read a zip entry as a UTF-8 string. */
function zipEntryText(zip: AdmZip, entry: string): string {
  return zip.readFile(entry)?.toString('utf-8') ?? '';
}

/** Download a zip file from S3 and return it as an AdmZip instance. */
async function downloadZipFromS3(storageService: ObjectStorageService, s3Key: string): Promise<AdmZip> {
  const fileStream = await storageService.getFileStream(BucketType.MAIN, s3Key);
  const chunks: Buffer[] = [];
  for await (const chunk of fileStream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return new AdmZip(Buffer.concat(chunks));
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
  const createdSubmissionFeatureIds: number[] = [];
  const createdSubmissionIds: number[] = [];
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
      // 1. Delete downloads (cascades to download_feature, download_fragment, download_fragment_feature)
      if (createdDownloadIds.length > 0) {
        await db('biohub.download').whereIn('download_id', createdDownloadIds).del();
      }

      // 2. Delete submission features
      if (createdSubmissionFeatureIds.length > 0) {
        await db('biohub.submission_feature').whereIn('submission_feature_id', createdSubmissionFeatureIds).del();
      }

      // 2b. Delete artifact records
      if (createdArtifactIds.length > 0) {
        await db('biohub.artifact').whereIn('artifact_id', createdArtifactIds).del();
      }

      // 3. Delete submissions
      if (createdSubmissionIds.length > 0) {
        await db('biohub.submission').whereIn('submission_id', createdSubmissionIds).del();
      }

      if (createdTicketIds.length > 0) {
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

    const ticketId = await getOrCreateTestTicketId(db, submissionId, upload.upload_id, SYSTEM_USER_ID);

    const [bridge] = await db('biohub.submission_upload')
      .insert({
        submission_id: submissionId,
        upload_id: upload.upload_id,
        ticket_id: ticketId,
        create_user: SYSTEM_USER_ID
      })
      .returning('submission_upload_id');

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
   * Create a download record, link features, publish the job to pg-boss, and wait for completion.
   */
  async function createDownloadAndProcess(
    featureIds: number[],
    downloadOverrides?: Record<string, unknown>
  ): Promise<number> {
    const [download] = await db('biohub.download')
      .insert({
        download_status: 'pending',
        create_user: SYSTEM_USER_ID,
        ...downloadOverrides
      })
      .returning('download_id');
    createdDownloadIds.push(download.download_id);

    await db('biohub.download_feature').insert(
      featureIds.map((id) => ({
        download_id: download.download_id,
        submission_feature_id: id,
        create_user: SYSTEM_USER_ID
      }))
    );

    const boss = await initPgBoss();
    await boss.createQueue('process-download');
    const jobId = await boss.send('process-download', {
      downloadId: download.download_id,
      teamId: null
    });
    expect(jobId).to.be.a('string');

    await waitForDownloadStatus(db, download.download_id, 'ready');

    return download.download_id;
  }

  it('should process a download job and upload zip to S3', async () => {
    // 1. Create test data: submission with parent dataset and child features
    const submissionId = await createTestSubmission();

    // Create parent dataset feature (no parent - root feature)
    const datasetFeatureId = await createTestFeature(submissionId, 'dataset', {
      name: 'BC Grizzly Bear Survey 2024',
      start_date: '2024-01-01T00:00:00.000Z',
      end_date: '2024-12-31T00:00:00.000Z',
      geometry: { type: 'Point', coordinates: [-124.856, 54.321] }
    });

    // Create child sample_site feature with parent reference
    const sampleSiteFeatureId = await createTestFeature(
      submissionId,
      'sample_site',
      {
        name: 'Sample Site creek meadow ridge',
        description: 'Rocky streambed, with gravel substrate',
        geometry: { type: 'Point', coordinates: [-130.849, 56.207] }
      },
      datasetFeatureId // parent dataset
    );

    // 1b. Upload a small test file to S3 and create artifact + file feature
    const testFileKey = `${TEST_PREFIX}/test-image.png`;
    const testFileContent = Buffer.from('PNG-fake-binary-content-for-integration-test');
    await storageService.uploadBuffer(BucketType.MAIN, testFileContent, 'image/png', testFileKey);
    createdS3Keys.push(testFileKey);

    const bucketName = process.env.OBJECT_STORE_BUCKET_NAME!;
    const [artifact] = await db('biohub.artifact')
      .insert({
        bucket: bucketName,
        object_key: testFileKey,
        byte_size: testFileContent.length,
        artifact_status: 'uploaded',
        uploaded_at: new Date().toISOString(),
        create_user: SYSTEM_USER_ID
      })
      .returning('artifact_id');
    createdArtifactIds.push(artifact.artifact_id);

    // Create child file feature with parent reference
    const fileFeatureId = await createTestFeature(
      submissionId,
      'file',
      {
        file: testFileKey
      },
      datasetFeatureId // parent dataset
    );

    // 2. Create download, link features, publish job, and wait for completion
    const downloadId = await createDownloadAndProcess([datasetFeatureId, sampleSiteFeatureId, fileFeatureId]);

    // 3. Verify download record was updated correctly
    const [finalDownload] = await db('biohub.download').where('download_id', downloadId).select('*');

    expect(finalDownload.download_status).to.equal('ready');
    // Note: started_at on the parent download is null because the download pipeline
    // transitions the parent directly from 'pending' to 'ready' (only fragments get 'processing' status)
    expect(finalDownload.completed_at).to.not.be.null;
    expect(finalDownload.total_fragments).to.be.greaterThanOrEqual(1);
    expect(finalDownload.completed_fragments).to.equal(finalDownload.total_fragments);

    // File info now lives on the fragment, not the download record
    const [fragment] = await db('biohub.download_fragment').where('download_id', downloadId).select('*');
    expect(fragment.s3_key).to.be.a('string');
    expect(fragment.file_name).to.include(`biohub-${downloadId}`);
    expect(Number(fragment.file_size_bytes)).to.be.greaterThan(0);

    // Track S3 key for cleanup
    createdS3Keys.push(fragment.s3_key);

    // 4. Verify S3 object exists and has content
    const metadata = await storageService.getMetadata(BucketType.MAIN, fragment.s3_key);
    expect(metadata).to.exist;
    expect(metadata.ContentLength).to.be.greaterThan(0);

    // 5. Download and inspect zip contents
    const zip = await downloadZipFromS3(storageService, fragment.s3_key);
    const entries = zip.getEntries().map((e) => e.entryName);

    // Zip entries are nested under a root folder: biohub-{downloadId}/
    const rootFolder = `biohub-${downloadId}/`;

    // Should contain one CSV per feature type (file features become multimedia.csv)
    expect(entries).to.include(`${rootFolder}dataset.csv`);
    expect(entries).to.include(`${rootFolder}sample_site.csv`);
    expect(entries).to.include(`${rootFolder}multimedia.csv`);

    // Verify binary file exists in the zip (CSV content verified by service tests)
    const expectedFilePath = `${rootFolder}files/${fileFeatureId}_test-image.png`;
    expect(entries).to.include(expectedFilePath);
    const binaryContent = zip.readFile(expectedFilePath);
    expect(binaryContent).to.not.be.null;
    expect(binaryContent!.equals(testFileContent)).to.be.true;

    // 6. Verify fragment records were created
    const fragments = await db('biohub.download_fragment').where('download_id', downloadId).orderBy('fragment_index');

    expect(fragments).to.have.length.greaterThanOrEqual(1);
    expect(fragments[0].fragment_status).to.equal('ready');
    expect(fragments[0].s3_key).to.be.a('string');

    // Track fragment S3 keys for cleanup
    for (const frag of fragments) {
      if (frag.s3_key) {
        createdS3Keys.push(frag.s3_key);
      }
    }
  });

  it('should create multiple fragments when fragment_size_bytes is small', async () => {
    // 1. Create test data: submission with parent dataset, child telemetry, and file features
    const submissionId = await createTestSubmission();

    // Create parent dataset feature (no parent - root feature)
    const datasetFeatureId = await createTestFeature(submissionId, 'dataset', {
      name: 'Multi-fragment Test Dataset',
      start_date: '2024-01-01T00:00:00.000Z',
      end_date: '2024-12-31T00:00:00.000Z',
      geometry: { type: 'Point', coordinates: [-121.5, 49.25] }
    });

    // Create child telemetry feature with parent reference
    const telemetryFeatureId = await createTestFeature(
      submissionId,
      'telemetry',
      {
        geometry: { type: 'Point', coordinates: [-120.463, 55.905] },
        timestamp: '2026-02-05T14:15:06.606Z',
        dop: 3.2,
        elevation: 1150
      },
      datasetFeatureId // parent dataset
    );

    // 1b. Upload test files to S3 and create file features
    const testFileA = { key: `${TEST_PREFIX}/frag-test-a.txt`, content: Buffer.from('fragment-file-A') };
    const testFileB = { key: `${TEST_PREFIX}/frag-test-b.txt`, content: Buffer.from('fragment-file-B') };
    const bucketName = process.env.OBJECT_STORE_BUCKET_NAME!;

    for (const file of [testFileA, testFileB]) {
      await storageService.uploadBuffer(BucketType.MAIN, file.content, 'text/plain', file.key);
      createdS3Keys.push(file.key);
      await db('biohub.artifact').insert({
        bucket: bucketName,
        object_key: file.key,
        byte_size: file.content.length,
        artifact_status: 'uploaded',
        uploaded_at: new Date().toISOString(),
        create_user: SYSTEM_USER_ID
      });
      createdArtifactIds.push((await db('biohub.artifact').where('object_key', file.key).first()).artifact_id);
    }

    const fileFeatureIdA = await createTestFeature(submissionId, 'file', { file: testFileA.key }, datasetFeatureId);
    const fileFeatureIdB = await createTestFeature(submissionId, 'file', { file: testFileB.key }, datasetFeatureId);

    // 2. Create download with tiny fragment size, link features, publish job, and wait
    const downloadId = await createDownloadAndProcess(
      [datasetFeatureId, telemetryFeatureId, fileFeatureIdA, fileFeatureIdB],
      { fragment_size_bytes: 1 }
    );

    // 3. Verify download record
    const [finalDownload] = await db('biohub.download').where('download_id', downloadId).select('*');

    expect(finalDownload.download_status).to.equal('ready');
    expect(finalDownload.total_fragments).to.be.greaterThanOrEqual(2);
    expect(finalDownload.completed_fragments).to.equal(finalDownload.total_fragments);

    // 4. Verify fragment records
    const fragments = await db('biohub.download_fragment').where('download_id', downloadId).orderBy('fragment_index');

    expect(fragments).to.have.length.greaterThanOrEqual(2);

    const s3Keys = new Set<string>();
    for (const frag of fragments) {
      expect(frag.fragment_status).to.equal('ready');
      expect(frag.s3_key).to.be.a('string');
      // Each fragment S3 key uses part naming: biohub-{id}-part-{n}.zip
      expect(frag.s3_key).to.match(new RegExp(String.raw`biohub-${downloadId}-part-\d+\.zip`));
      s3Keys.add(frag.s3_key);
      createdS3Keys.push(frag.s3_key);
    }

    // All fragment S3 keys should be unique
    expect(s3Keys.size).to.equal(fragments.length);

    // 5. Download each fragment zip and verify CSV content
    const allCsvEntries: string[] = [];
    const allCsvContent: Record<string, string> = {};

    for (const frag of fragments) {
      const zip = await downloadZipFromS3(storageService, frag.s3_key);
      const entries = zip.getEntries().map((e) => e.entryName);

      // Each fragment should contain at least one CSV
      expect(entries.length).to.be.greaterThanOrEqual(1);

      for (const entry of entries) {
        // Strip root folder prefix for cross-fragment accumulation (e.g. biohub-123-part-1/dataset.csv → dataset.csv)
        const baseName = entry.replace(/^biohub-[^/]+\//, '');
        allCsvEntries.push(baseName);
        const content = zipEntryText(zip, entry);
        const parsed = content.trim();
        // Accumulate CSV content (append rows, skip duplicate headers)
        if (allCsvContent[baseName]) {
          const lines = parsed.split('\n');
          // Skip header row (already captured), append data rows
          allCsvContent[baseName] += '\n' + lines.slice(1).join('\n');
        } else {
          allCsvContent[baseName] = parsed;
        }
      }
    }

    // 6. Verify combined CSVs cover all original features
    // Should have CSVs for both feature types across all fragments
    expect(allCsvEntries).to.include('dataset.csv');
    expect(allCsvEntries).to.include('telemetry.csv');

    // Verify CSV content across fragments (header/column checks covered by service tests)
    const datasetLines = allCsvContent['dataset.csv'].split('\n');
    expect(datasetLines.length).to.equal(2); // header + 1 data row
    expect(datasetLines[1]).to.include('Multi-fragment Test Dataset');

    const telemetryLines = allCsvContent['telemetry.csv'].split('\n');
    expect(telemetryLines.length).to.equal(2); // header + 1 data row
    expect(telemetryLines[1]).to.include('Multi-fragment Test Dataset'); // parent dataset_name

    // 7. Verify multimedia.csv filePath references use per-fragment files folders (files1, files2, etc.)
    expect(allCsvEntries).to.include('multimedia.csv');
    const multimediaCsv = allCsvContent['multimedia.csv'];
    const multimediaLines = multimediaCsv.split('\n');
    expect(multimediaLines.length).to.equal(3); // header + 2 file rows

    // Each fragment's multimedia.csv should reference its own filesN/ folder, not bare files/
    // Collect all file entries across all fragment zips
    const allFileEntries: string[] = [];
    for (const frag of fragments) {
      const zip = await downloadZipFromS3(storageService, frag.s3_key);
      const entries = zip.getEntries().map((e) => e.entryName);
      allFileEntries.push(
        ...entries.map((e) => e.replace(/^biohub-[^/]+\//, '')).filter((e) => e.match(/^files\d+\//))
      );
    }

    // Multi-fragment: files should be in numbered folders (files1/, files2/, etc.), not bare files/
    expect(allFileEntries.length).to.equal(2);
    for (const fileEntry of allFileEntries) {
      expect(fileEntry).to.match(/^files\d+\//);
    }

    // multimedia.csv filePath column should reference the same numbered paths
    for (const fileEntry of allFileEntries) {
      expect(multimediaCsv).to.include(fileEntry);
    }
  });
});

/**
 * Tests for the download pipeline — verifies CSV generation, zip packaging, and S3 upload.
 * These tests call service methods directly (no pg-boss) but still require MinIO for S3 operations.
 *
 * Run: make test-sys
 * Requires: make web (database + MinIO must be running)
 */
describe('DownloadPipelineService download pipeline (system)', function () {
  this.timeout(30000);

  let connection: IDBConnection;
  let service: DownloadPipelineService;
  let crudService: DownloadService;
  const storageService = new ObjectStorageService();
  const s3KeysToCleanup: string[] = [];

  before(() => {
    initDBPool(defaultPoolConfig);
  });

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    service = new DownloadPipelineService(connection);
    crudService = new DownloadService(connection);
  });

  afterEach(async () => {
    for (const key of s3KeysToCleanup) {
      try {
        await storageService.deleteFile(BucketType.MAIN, key);
      } catch {
        /* may not exist */
      }
    }
    s3KeysToCleanup.length = 0;

    await connection.rollback();
    connection.release();
  });

  /**
   * Download a zip from S3, track the key for cleanup, and return an AdmZip instance.
   */
  async function downloadAndTrackZip(s3Key: string): Promise<AdmZip> {
    s3KeysToCleanup.push(s3Key);
    return downloadZipFromS3(storageService, s3Key);
  }

  /**
   * Helper: run the full download pipeline and return the resulting zip.
   */
  async function executeAndGetZip(featureIds: number[]): Promise<{ zip: AdmZip; downloadId: string }> {
    const { download_id } = await crudService.createDownloadRequest({
      submissionFeatureIds: featureIds
    });

    // Run the three-phase pipeline within the test transaction
    await service.planDownloadIfNeeded(download_id);
    const fragments = await service.getFragmentsToProcess(download_id);
    for (const fragment of fragments) {
      await service.processFragment(fragment, download_id);
    }
    await service.finalizeDownload(download_id);

    const download = await crudService.findDownloadById(download_id);
    expect(download).to.not.be.null;
    expect(download!.download_status).to.equal(DownloadStatusEnum.READY);

    // s3_key lives on the fragment, not the download record
    const allFragments = await crudService.getFragmentsByDownloadId(download_id);
    expect(allFragments.length).to.be.greaterThanOrEqual(1);
    const zip = await downloadAndTrackZip(allFragments[0].s3_key as string);
    return { zip, downloadId: download_id };
  }

  it('should produce correct CSV for populated and empty dataset features', async () => {
    const submissionId = await createTestSubmission(connection);
    const populatedId = await createTestFeature(connection, submissionId, 'dataset', {
      name: 'Solo Dataset',
      start_date: '2024-03-01T00:00:00.000Z',
      end_date: '2024-09-30T00:00:00.000Z',
      geometry: { type: 'Point', coordinates: [-123.37, 48.428] }
    });
    const emptyId = await createTestFeature(connection, submissionId, 'dataset', {});

    const { zip, downloadId } = await executeAndGetZip([populatedId, emptyId]);
    const rootFolder = `biohub-${downloadId}/`;

    const entries = zip.getEntries().map((e) => e.entryName);
    expect(entries).to.include(`${rootFolder}dataset.csv`);
    expect(entries).to.have.lengthOf(1);

    const csv = zipEntryText(zip, `${rootFolder}dataset.csv`);
    const lines = parseCsvLines(csv);
    expect(lines).to.have.lengthOf(3); // header + 2 data rows

    const headers = lines[0].split(',');
    // Core file (dataset) has uuid only as system column
    expect(headers[0]).to.equal('uuid');
    expect(headers).to.not.include('dataset_name');
    expect(headers).to.not.include('dataset_uuid');
    expect(headers).to.include('name');
    expect(headers).to.include('start_date');
    expect(headers).to.include('end_date');
    // dataset schema does NOT include geometry, so no spatial columns
    expect(headers).to.not.include('decimalLatitude');

    // Populated row has values
    expect(lines[1]).to.include('Solo Dataset');

    // Empty row: schema columns present but data cells are empty
    const emptyRowValues = lines[2].split(',');
    const nameIndex = headers.indexOf('name');
    expect(emptyRowValues[nameIndex]).to.equal('');
  });

  it('should produce multi-row CSV with sparse data and correct schema columns', async () => {
    const submissionId = await createTestSubmission(connection);

    const datasetFeatureId = await createTestFeature(connection, submissionId, 'dataset', {
      name: 'Telemetry Parent Dataset'
    });

    // Feature 1: sparse — only geometry + timestamp (no dop/elevation)
    const featureId1 = await createTestFeature(
      connection,
      submissionId,
      'telemetry',
      {
        geometry: { type: 'Point', coordinates: [-127.891, 54.357] },
        timestamp: '2024-06-15T08:15:30.000Z'
      },
      datasetFeatureId
    );
    // Feature 2: fully populated
    const featureId2 = await createTestFeature(
      connection,
      submissionId,
      'telemetry',
      {
        geometry: { type: 'Point', coordinates: [-125.3, 52.891] },
        timestamp: '2024-07-20T14:30:00.000Z',
        dop: 5.1,
        elevation: 1203
      },
      datasetFeatureId
    );

    const { zip, downloadId } = await executeAndGetZip([featureId1, featureId2]);
    const rootFolder = `biohub-${downloadId}/`;

    const entries = zip.getEntries().map((e) => e.entryName);
    expect(entries).to.include(`${rootFolder}telemetry.csv`);
    expect(entries).to.have.lengthOf(1);

    const csv = zipEntryText(zip, `${rootFolder}telemetry.csv`);
    const lines = parseCsvLines(csv);
    expect(lines).to.have.lengthOf(3);

    const headers = lines[0].split(',');
    // System columns are first three columns
    expect(headers[0]).to.equal('uuid');
    expect(headers[1]).to.equal('dataset_name');
    expect(headers[2]).to.equal('dataset_uuid');
    // All schema columns present regardless of sparse data
    expect(headers).to.include('decimalLatitude');
    expect(headers).to.include('decimalLongitude');
    expect(headers).to.include('timestamp');
    expect(headers).to.include('dop');
    expect(headers).to.include('elevation');

    const dataContent = lines.slice(1).join('\n');
    expect(dataContent).to.include('Telemetry Parent Dataset');
    expect(dataContent).to.include('2024-06-15T08:15:30.000Z');
    expect(dataContent).to.include('2024-07-20T14:30:00.000Z');

    // Sparse row: dop and elevation should be empty
    const row1Values = lines[1].split(',');
    const dopIndex = headers.indexOf('dop');
    const elevationIndex = headers.indexOf('elevation');
    expect(row1Values[dopIndex]).to.equal('');
    expect(row1Values[elevationIndex]).to.equal('');

    // Full row: dop and elevation populated
    const row2Values = lines[2].split(',');
    expect(row2Values[dopIndex]).to.equal('5.1');
    expect(row2Values[elevationIndex]).to.equal('1203');

    // Verify fragment metadata
    const fragments = await crudService.getFragmentsByDownloadId(downloadId);
    expect(fragments).to.have.lengthOf(1);
    expect(fragments[0].fragment_status).to.equal(DownloadStatusEnum.READY);
    expect(fragments[0].fragment_index).to.equal(0);
    expect(fragments[0].s3_key).to.be.a('string');
    expect(fragments[0].file_name).to.include(`biohub-${downloadId}`);
    expect(Number(fragments[0].file_size_bytes)).to.be.greaterThan(0);
    expect(fragments[0].feature_count).to.equal(2);

    // Verify signed URL
    const signedUrl = await crudService.getFragmentSignedUrl(downloadId, 0);
    expect(signedUrl).to.be.a('string');
    expect(signedUrl).to.include('download');
  });

  it('should produce an error placeholder when file feature references non-existent S3 key', async () => {
    const submissionId = await createTestSubmission(connection);
    const featureId = await createTestFeature(connection, submissionId, 'file', {
      file: 'non-existent/missing-image.png'
    });

    const { zip, downloadId } = await executeAndGetZip([featureId]);
    const rootFolder = `biohub-${downloadId}/`;

    const entries = zip.getEntries().map((e) => e.entryName);

    expect(entries).to.include(`${rootFolder}multimedia.csv`);

    const errorEntry = entries.find((e) => e.endsWith('.error.txt')) as string;
    expect(errorEntry).to.not.be.undefined;
    expect(errorEntry).to.include(`files/${featureId}_missing-image.png.error.txt`);

    const errorContent = zipEntryText(zip, errorEntry);
    expect(errorContent).to.include('Error');
    expect(errorContent).to.include('non-existent/missing-image.png');

    const multimediaCsv = zipEntryText(zip, `${rootFolder}multimedia.csv`);
    const multimediaLines = parseCsvLines(multimediaCsv);
    const multimediaHeaders = multimediaLines[0].split(',');
    expect(multimediaHeaders).to.include('filePath');
    expect(multimediaCsv).to.include(`files/${featureId}_missing-image.png`);
  });

  it('should stream multiple file features sequentially without corrupting any entries', async () => {
    const submissionId = await createTestSubmission(connection);
    const systemUserId = connection.systemUserId();
    const bucketName = process.env.OBJECT_STORE_BUCKET_NAME!;

    // Upload 3 files of different sizes to exercise the entryDrained serialization
    const testFiles = [
      { key: `${TEST_PREFIX}/multi-file-a.txt`, content: Buffer.from('A'.repeat(100)) },
      { key: `${TEST_PREFIX}/multi-file-b.csv`, content: Buffer.from('col1,col2\n1,2\n3,4\n5,6') },
      { key: `${TEST_PREFIX}/multi-file-c.bin`, content: Buffer.alloc(512, 0xab) }
    ];

    const featureIds: number[] = [];

    for (const file of testFiles) {
      await storageService.uploadBuffer(BucketType.MAIN, file.content, 'application/octet-stream', file.key);
      s3KeysToCleanup.push(file.key);

      await connection.sql(SQL`
        INSERT INTO artifact (bucket, object_key, byte_size, artifact_status, uploaded_at, create_user)
        VALUES (${bucketName}, ${file.key}, ${file.content.length}, 'uploaded', now(), ${systemUserId});
      `);

      const featureId = await createTestFeature(connection, submissionId, 'file', {
        file: file.key
      });
      featureIds.push(featureId);
    }

    const { zip, downloadId } = await executeAndGetZip(featureIds);
    const rootFolder = `biohub-${downloadId}/`;

    const entries = zip.getEntries().map((e) => e.entryName);

    // multimedia.csv should list all 3 files
    expect(entries).to.include(`${rootFolder}multimedia.csv`);
    const multimediaCsv = zipEntryText(zip, `${rootFolder}multimedia.csv`);
    const lines = parseCsvLines(multimediaCsv);
    expect(lines).to.have.lengthOf(4); // header + 3 data rows
    const multiFileHeaders = lines[0].split(',');
    expect(multiFileHeaders).to.include('filePath');

    // Verify each binary file is present and has the correct content
    for (let i = 0; i < testFiles.length; i++) {
      const fileName = testFiles[i].key.split('/').pop()!;
      const expectedPath = `${rootFolder}files/${featureIds[i]}_${fileName}`;

      expect(entries).to.include(expectedPath);

      const binaryContent = zip.readFile(expectedPath);
      expect(binaryContent).to.not.be.null;
      expect(binaryContent!.equals(testFiles[i].content)).to.be.true;

      // multimedia.csv should reference this file
      expect(multimediaCsv).to.include(expectedPath);
    }
  });

  it('should denormalize non-dataset parent columns into child CSV', async () => {
    // Hierarchy: dataset → telemetry_deployment → telemetry
    // Verifies telemetry CSV includes deployment's columns (not just dataset context)
    const submissionId = await createTestSubmission(connection);

    const datasetId = await createTestFeature(connection, submissionId, 'dataset', {
      name: 'Denorm Test Dataset'
    });

    const deploymentId = await createTestFeature(
      connection,
      submissionId,
      'telemetry_deployment',
      {
        device_key: 'lotek:41111',
        animal_identifier: 'BEAR-001',
        start_date: '2024-06-01',
        end_date: '2025-01-01'
      },
      datasetId
    );

    const telemetryId = await createTestFeature(
      connection,
      submissionId,
      'telemetry',
      {
        timestamp: '2024-06-16T02:58:02.241Z',
        geometry: { type: 'Point', coordinates: [-127.099, 54.576] },
        dop: 2.5,
        elevation: 1150
      },
      deploymentId
    );

    const { zip, downloadId } = await executeAndGetZip([telemetryId]);
    const rootFolder = `biohub-${downloadId}/`;

    const csv = zipEntryText(zip, `${rootFolder}telemetry.csv`);
    const lines = parseCsvLines(csv);
    const headers = lines[0].split(',');

    // System columns
    expect(headers[0]).to.equal('uuid');
    expect(headers[1]).to.equal('dataset_name');
    expect(headers[2]).to.equal('dataset_uuid');

    // Parent (deployment) columns denormalized into telemetry
    expect(headers).to.include('device_key');
    expect(headers).to.include('animal_identifier');
    expect(headers).to.include('start_date');

    // Own columns
    expect(headers).to.include('timestamp');
    expect(headers).to.include('dop');
    expect(headers).to.include('decimalLatitude');

    // Parent values present in data row
    expect(lines[1]).to.include('lotek:41111');
    expect(lines[1]).to.include('BEAR-001');
    // Dataset context
    expect(lines[1]).to.include('Denorm Test Dataset');
  });
});
