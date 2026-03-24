// Integration test for process-submission-features pg-boss worker (full flow).
//
// Run: make test-sys
// Requires: make web && make queue
import { expect } from 'chai';
import { Knex, knex } from 'knex';
import { randomInt, randomUUID } from 'node:crypto';
import SQL from 'sql-template-strings';
import * as tar from 'tar-stream';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { JobQueues } from '../../queue/jobs';
import { getPgBoss, initPgBoss, stopPgBoss } from '../../queue/pg-boss-service';
import { publishProcessSubmissionFeaturesJob } from '../../queue/publisher';
import { SubmissionIngestionService } from '../../services/ingestion/submission-ingestion-service';
import { BucketType, ObjectStorageService } from '../../services/object-storage/object-storage-service';
import { getOrCreateIntegrationTicketId } from '../helpers/test-submission-helpers';
import { getOrCreateTestTicketId } from '../helpers/test-ticket-helpers';

const TEST_PREFIX = '__integration-test__';
const SYSTEM_USER_ID = 2; // biohub_api system user

/**
 * Create a test ticket row and return its id for submission_upload FK linkage.
 */
async function createTestTicketId(db: Knex): Promise<string> {
  const [team] = await db('biohub.team').select('team_id').limit(1);
  if (!team?.team_id) {
    throw new Error('No team row found for ticket setup');
  }

  const ticketSlug = String(randomInt(0, 100_000_000)).padStart(8, '0');
  const [ticket] = await db('biohub.ticket')
    .insert({
      ticket_slug: ticketSlug,
      subject: `${TEST_PREFIX}-ticket`,
      description: 'System integration test ticket',
      team_id: team.team_id,
      create_user: SYSTEM_USER_ID
    })
    .returning('ticket_id');

  return ticket.ticket_id;
}

async function createTarBuffer(files: { name: string; content: string }[]): Promise<Buffer> {
  const prefix = randomUUID();
  return new Promise((resolve) => {
    const pack = tar.pack();
    const chunks: Buffer[] = [];
    pack.on('data', (chunk: Buffer) => chunks.push(chunk));
    pack.on('end', () => resolve(Buffer.concat(chunks)));
    pack.entry({ name: `${prefix}/`, type: 'directory', size: 0 }, '');
    for (const file of files) {
      pack.entry({ name: `${prefix}/${file.name}` }, file.content);
    }
    pack.finalize();
  });
}

async function waitForValidationStatus(
  db: Knex,
  submissionId: number,
  timeoutMs = 30000
): Promise<{ status: string; metadata: unknown }> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const [row] = await db('biohub.submission_validation')
      .where('submission_id', submissionId)
      .select('status', 'metadata')
      .orderBy('submission_validation_id', 'desc')
      .limit(1);
    if (row && row.status !== 'pending' && row.status !== 'started') {
      return row;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Timeout waiting for validation status');
}

/**
 * Poll submission_upload until it reaches one of the expected statuses.
 */
async function waitForSubmissionUploadStatus(
  db: Knex,
  submissionUploadId: string,
  expectedStatuses: string[],
  timeoutMs = 30000
): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const [row] = await db('biohub.submission_upload')
      .where('submission_upload_id', submissionUploadId)
      .select('status')
      .limit(1);
    if (row?.status && expectedStatuses.includes(row.status)) {
      return row.status;
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  throw new Error('Timeout waiting for submission_upload status');
}

describe('Process Submission Features Worker', function () {
  this.timeout(60000);

  let db: Knex;
  let storageService: ObjectStorageService;

  // Track created resources for cleanup (upload_id and artifact_id are UUIDs)
  const createdSubmissionIds: number[] = [];
  const createdUploadIds: string[] = [];
  const createdArtifactIds: string[] = [];
  const createdTicketIds: string[] = [];
  const createdObjectKeys: string[] = [];

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

    // Initialize DB pool (needed by getAPIUserDBConnection used in publisher and job handler)
    initDBPool(defaultPoolConfig);

    await initPgBoss();

    // Ensure queue exists with 'short' policy (enforces singletonKey uniqueness).
    // createQueue is ON CONFLICT DO NOTHING, so if the queue already exists with 'standard'
    // policy from a previous startup, we must update it directly.
    const boss = getPgBoss();
    await boss.createQueue(JobQueues.PROCESS_SUBMISSION_FEATURES);
    await db.raw(`UPDATE pgboss.queue SET policy = 'short' WHERE name = ? AND policy != 'short'`, [
      JobQueues.PROCESS_SUBMISSION_FEATURES
    ]);
  });

  after(async () => {
    try {
      // Clean up in reverse FK order
      for (const submissionId of createdSubmissionIds) {
        // search_ tables FK to submission_feature — delete first
        const featureIds = await db('biohub.submission_feature')
          .where('submission_id', submissionId)
          .select('submission_feature_id');
        const ids = featureIds.map((r: { submission_feature_id: number }) => r.submission_feature_id);
        if (ids.length) {
          await db('biohub.search_string').whereIn('submission_feature_id', ids).del();
          await db('biohub.search_number').whereIn('submission_feature_id', ids).del();
          await db('biohub.search_datetime').whereIn('submission_feature_id', ids).del();
          await db('biohub.search_spatial').whereIn('submission_feature_id', ids).del();
        }
        await db('biohub.submission_feature').where('submission_id', submissionId).del();
        await db('biohub.submission_validation').where('submission_id', submissionId).del();
        await db('biohub.submission_upload').where('submission_id', submissionId).del();
      }

      for (const uploadId of createdUploadIds) {
        await db('biohub.upload_artifact').where('upload_id', uploadId).del();
        await db('biohub.upload_archive').where('upload_id', uploadId).del();
      }

      for (const artifactId of createdArtifactIds) {
        await db('biohub.artifact').where('artifact_id', artifactId).del();
      }

      for (const uploadId of createdUploadIds) {
        await db('biohub.upload').where('upload_id', uploadId).del();
      }

      for (const submissionId of createdSubmissionIds) {
        await db('biohub.submission').where('submission_id', submissionId).del();
      }

      if (createdTicketIds.length) {
        await db('biohub.ticket').whereIn('ticket_id', createdTicketIds).del();
      }

      // Clean up S3 objects
      for (const key of createdObjectKeys) {
        try {
          await storageService.deleteFile(BucketType.MAIN, key);
        } catch {
          /* may already be deleted */
        }
      }
    } catch (error_) {
      console.warn('Cleanup failed:', error_);
    }

    await stopPgBoss();
    await db.destroy();
  });

  /**
   * Sets up the full FK chain in the database and uploads a TAR to S3.
   */
  async function setupSubmissionWithTar(tarBuffer: Buffer): Promise<{
    submissionId: number;
    uploadId: string;
    submissionUploadId: string;
    ticketId: string;
    artifactId: string;
    objectKey: string;
  }> {
    const objectKey = `${TEST_PREFIX}/${Date.now()}/archive.tar`;

    // Upload TAR to MAIN bucket (post-scan, archive already promoted)
    await storageService.uploadBuffer(BucketType.MAIN, tarBuffer, 'application/x-tar', objectKey);
    createdObjectKeys.push(objectKey);

    // 1. submission (uuid, system_user_id, contributor_id, name, description, comment required)
    const [submission] = await db('biohub.submission')
      .insert({
        uuid: randomUUID(),
        system_user_id: SYSTEM_USER_ID,
        contributor_id: 1,
        name: TEST_PREFIX,
        description: TEST_PREFIX,
        comment: TEST_PREFIX
      })
      .returning('submission_id');
    createdSubmissionIds.push(submission.submission_id);

    // 2. upload (upload_status and record_end_date required; upload_id is UUID auto-generated)
    const [upload] = await db('biohub.upload')
      .insert({
        upload_status: 'completed',
        record_end_date: new Date(Date.now() + 30 * 60 * 1000).toISOString()
      })
      .returning('upload_id');
    createdUploadIds.push(upload.upload_id);

    // 3. artifact (artifact_id is UUID auto-generated; create_user set by audit trigger)
    const [artifact] = await db('biohub.artifact')
      .insert({
        bucket: process.env.OBJECT_STORE_BUCKET_NAME,
        object_key: objectKey,
        byte_size: tarBuffer.length,
        artifact_status: 'uploaded',
        uploaded_at: new Date().toISOString()
      })
      .returning('artifact_id');
    createdArtifactIds.push(artifact.artifact_id);

    // 4. upload_archive (status = completed, so job can find it)
    await db('biohub.upload_archive').insert({
      upload_id: upload.upload_id,
      artifact_id: artifact.artifact_id,
      archive_status: 'completed'
    });

    // 5. ticket (required FK for submission_upload)
    const ticketId = await getOrCreateTestTicketId(db, submission.submission_id, upload.upload_id, SYSTEM_USER_ID);

    // 6. submission_upload (links submission to upload)
    const [submissionUpload] = await db('biohub.submission_upload')
      .insert({
        submission_id: submission.submission_id,
        upload_id: upload.upload_id,
        ticket_id: ticketId
      })
      .returning('submission_upload_id');

    // 7. upload_artifact (required for JOIN in getSubmissionUploadsBySubmissionId)
    await db('biohub.upload_artifact').insert({
      upload_id: upload.upload_id,
      artifact_id: artifact.artifact_id,
      role: 'feature'
    });

    return {
      submissionId: submission.submission_id,
      uploadId: upload.upload_id,
      submissionUploadId: submissionUpload.submission_upload_id,
      ticketId,
      artifactId: artifact.artifact_id,
      objectKey
    };
  }

  it('should process a valid submission and reach completed status', async () => {
    const datasetId = randomUUID();
    const featureId = randomUUID();

    const tarBuffer = await createTarBuffer([
      { name: '.dataset-id', content: datasetId },
      {
        name: 'features/dataset.json',
        content: JSON.stringify([
          {
            id: featureId,
            type: 'dataset',
            properties: {
              name: 'Integration Test Dataset',
              focal_species: [12345],
              start_date: '2024-01-01'
            },
            content: [],
            parent: null
          }
        ])
      }
    ]);

    const { submissionId, uploadId, submissionUploadId, ticketId } = await setupSubmissionWithTar(tarBuffer);

    // Publish job (needs IDBConnection for submission_validation tracking)
    const connection = getAPIUserDBConnection();
    try {
      await connection.open();
      const result = await publishProcessSubmissionFeaturesJob(connection, {
        submission_upload_id: submissionUploadId,
        submission_id: submissionId,
        upload_id: uploadId,
        status: 'pending',
        ticket_id: ticketId
      });
      await connection.commit();
      expect(result.status).to.equal('published');
    } finally {
      connection.release();
    }

    // Wait for the worker to finish
    const validation = await waitForValidationStatus(db, submissionId);
    expect(validation.status).to.equal('completed');

    // Verify submission_feature rows were created
    const features = await db('biohub.submission_feature')
      .join('biohub.feature_type', 'submission_feature.feature_type_id', 'feature_type.feature_type_id')
      .where('submission_feature.submission_id', submissionId)
      .select('feature_type.name as feature_type_name');

    expect(features.length).to.be.greaterThanOrEqual(1);
    expect(features.some((f: { feature_type_name: string }) => f.feature_type_name === 'dataset')).to.be.true;
  });

  it('should prevent concurrent jobs for same submission via singleton key', async () => {
    // Singleton key is `submission-${submissionId}` (not per-upload). Prod runs 2 worker replicas —
    // per-upload keys would allow two uploads for the same submission to process simultaneously,
    // causing conflicting feature writes.
    //
    // Tests pg-boss singleton enforcement directly: two sends with the same key back-to-back,
    // the second should return null (ON CONFLICT DO NOTHING). Requires queue policy = 'short'.

    const boss = getPgBoss();
    const testSubmissionId = Date.now(); // unique per run, avoids collisions
    const singletonKey = `submission-${testSubmissionId}`;

    // Send first job — should succeed
    const jobId1 = await boss.send(
      JobQueues.PROCESS_SUBMISSION_FEATURES,
      { uploadId: randomUUID(), submissionId: testSubmissionId },
      { singletonKey, expireInSeconds: 5 }
    );
    expect(jobId1).to.not.be.null;

    // Send second job with same singleton key — should be rejected
    const jobId2 = await boss.send(
      JobQueues.PROCESS_SUBMISSION_FEATURES,
      { uploadId: randomUUID(), submissionId: testSubmissionId },
      { singletonKey, expireInSeconds: 5 }
    );
    expect(jobId2).to.be.null;

    // Clean up: cancel the test job so it doesn't interfere with other tests
    if (jobId1) {
      await boss.cancel(JobQueues.PROCESS_SUBMISSION_FEATURES, jobId1);
    }
  });

  it('should mark submission upload invalid for unknown feature type', async () => {
    const datasetId = randomUUID();
    const featureId = randomUUID();

    const tarBuffer = await createTarBuffer([
      { name: '.dataset-id', content: datasetId },
      {
        name: 'features/dataset.json',
        content: JSON.stringify([
          {
            id: featureId,
            type: 'nonexistent_type',
            properties: { name: 'Bad Feature' },
            content: [],
            parent: null
          }
        ])
      }
    ]);

    const { submissionId, uploadId, submissionUploadId, ticketId } = await setupSubmissionWithTar(tarBuffer);

    const connection = getAPIUserDBConnection();
    try {
      await connection.open();
      const result = await publishProcessSubmissionFeaturesJob(connection, {
        submission_upload_id: submissionUploadId,
        submission_id: submissionId,
        upload_id: uploadId,
        status: 'pending',
        ticket_id: ticketId
      });
      await connection.commit();
      expect(result.status).to.equal('published');
    } finally {
      connection.release();
    }

    const uploadStatus = await waitForSubmissionUploadStatus(db, submissionUploadId, ['invalid'], 60000);
    expect(uploadStatus).to.equal('invalid');
  });
});

/**
 * Service-level tests for SubmissionIngestionService.ingestSubmissionUpload().
 * Calls the service directly (no pg-boss), uses transaction rollback for cleanup.
 */
describe('SubmissionIngestionService pipeline (system)', function () {
  this.timeout(30000);

  let connection: IDBConnection;
  let service: SubmissionIngestionService;
  const storageService = new ObjectStorageService();
  let s3KeysToCleanup: string[];

  before(() => {
    initDBPool(defaultPoolConfig);
  });

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    service = new SubmissionIngestionService(connection);
    s3KeysToCleanup = [];
  });

  /**
   * Create a test ticket row using the active DB transaction connection.
   */
  async function createTestTicketIdForConnection(): Promise<string> {
    const teamResult = await connection.sql<{ team_id: number }>(SQL`SELECT team_id FROM biohub.team LIMIT 1`);
    if (!teamResult.rows[0]?.team_id) {
      throw new Error('No team row found for ticket setup');
    }

    const ticketSlug = String(randomInt(0, 100_000_000)).padStart(8, '0');
    const ticketResult = await connection.sql<{ ticket_id: string }>(
      SQL`INSERT INTO biohub.ticket (ticket_slug, subject, description, team_id, create_user)
          VALUES (${ticketSlug}, ${`${TEST_PREFIX}-ticket`}, ${'System integration test ticket'}, ${
        teamResult.rows[0].team_id
      }, ${SYSTEM_USER_ID})
          RETURNING ticket_id`
    );

    return ticketResult.rows[0].ticket_id;
  }

  afterEach(async () => {
    await connection.rollback();
    connection.release();

    // Clean up S3 objects (not rolled back by DB transaction)
    for (const key of s3KeysToCleanup) {
      try {
        await storageService.deleteFile(BucketType.MAIN, key);
      } catch {
        /* may already be deleted */
      }
    }
  });

  /**
   * Insert the full FK chain and upload a TAR to S3.
   * Same chain as the worker test's setupSubmissionWithTar, using connection.sql() for rollback cleanup.
   */
  async function setupSubmissionWithTar(
    tarBuffer: Buffer
  ): Promise<{ submissionId: number; uploadId: string; submissionUploadId: string; ticketId: string }> {
    const objectKey = `${TEST_PREFIX}/${Date.now()}/archive.tar`;

    await storageService.uploadBuffer(BucketType.MAIN, tarBuffer, 'application/x-tar', objectKey);
    s3KeysToCleanup.push(objectKey);

    // 1. submission
    const submissionResult = await connection.sql<{ submission_id: number }>(
      SQL`INSERT INTO biohub.submission (uuid, system_user_id, contributor_id, name, description, comment)
          VALUES (${randomUUID()}, ${SYSTEM_USER_ID}, 1, ${TEST_PREFIX}, ${TEST_PREFIX}, ${TEST_PREFIX})
          RETURNING submission_id`
    );
    const submissionId = submissionResult.rows[0].submission_id;

    // 2. upload
    const uploadResult = await connection.sql<{ upload_id: string }>(
      SQL`INSERT INTO biohub.upload (upload_status, record_end_date)
          VALUES ('completed', ${new Date(Date.now() + 30 * 60 * 1000).toISOString()})
          RETURNING upload_id`
    );
    const uploadId = uploadResult.rows[0].upload_id;

    // 3. artifact
    const artifactResult = await connection.sql<{ artifact_id: string }>(
      SQL`INSERT INTO biohub.artifact (bucket, object_key, byte_size, artifact_status, uploaded_at)
          VALUES (${process.env.OBJECT_STORE_BUCKET_NAME}, ${objectKey}, ${
        tarBuffer.length
      }, 'uploaded', ${new Date().toISOString()})
          RETURNING artifact_id`
    );
    const artifactId = artifactResult.rows[0].artifact_id;

    // 4. upload_archive
    await connection.sql(
      SQL`INSERT INTO biohub.upload_archive (upload_id, artifact_id, archive_status)
          VALUES (${uploadId}, ${artifactId}, 'completed')`
    );

    // 5. ticket (required FK for submission_upload)
    const ticketId = await getOrCreateIntegrationTicketId(connection, submissionId, uploadId, SYSTEM_USER_ID);

    // 6. submission_upload
    const submissionUploadResult = await connection.sql<{ submission_upload_id: string }>(
      SQL`INSERT INTO biohub.submission_upload (submission_id, upload_id, ticket_id)
          VALUES (${submissionId}, ${uploadId}, ${ticketId})
          RETURNING submission_upload_id`
    );
    const submissionUploadId = submissionUploadResult.rows[0].submission_upload_id;

    // 6. upload_artifact
    await connection.sql(
      SQL`INSERT INTO biohub.upload_artifact (upload_id, artifact_id, role)
          VALUES (${uploadId}, ${artifactId}, 'feature')`
    );

    return { submissionId, uploadId, submissionUploadId, ticketId };
  }

  it('should process a valid submission and create features', async () => {
    const datasetId = randomUUID();
    const datasetFeatureId = randomUUID();
    const siteFeatureId = randomUUID();

    const tarBuffer = await createTarBuffer([
      { name: '.dataset-id', content: datasetId },
      {
        name: 'features/dataset.json',
        content: JSON.stringify([
          {
            id: datasetFeatureId,
            type: 'dataset',
            properties: {
              name: 'Test Dataset',
              focal_species: [12345],
              start_date: '2024-01-01'
            },
            content: [siteFeatureId],
            parent: null
          }
        ])
      },
      {
        name: 'features/sample_site.json',
        content: JSON.stringify([
          {
            id: siteFeatureId,
            type: 'sample_site',
            properties: { name: 'Test Site' },
            content: [],
            parent: datasetFeatureId
          }
        ])
      }
    ]);

    const { submissionId, uploadId, submissionUploadId, ticketId } = await setupSubmissionWithTar(tarBuffer);
    const result = await service.ingestSubmissionUpload({
      submission_upload_id: submissionUploadId,
      submission_id: submissionId,
      upload_id: uploadId,
      status: 'pending',
      ticket_id: ticketId
    });

    expect(result.valid).to.be.true;
    expect(result.errors).to.have.lengthOf(0);

    // Verify features were inserted with correct types and parent relationships
    const features = await connection.sql<{ feature_type_name: string; parent_submission_feature_id: number | null }>(
      SQL`SELECT ft.name as feature_type_name, sf.parent_submission_feature_id
          FROM biohub.submission_feature sf
          JOIN biohub.feature_type ft ON sf.feature_type_id = ft.feature_type_id
          WHERE sf.submission_id = ${submissionId}
          ORDER BY ft.name`
    );

    const typeNames = features.rows.map((r) => r.feature_type_name);
    expect(typeNames).to.include('dataset');
    expect(typeNames).to.include('sample_site');

    // Parent relationships are unresolved in raw ingest (handled later by indexing).
    const dataset = features.rows.find((r) => r.feature_type_name === 'dataset');
    const site = features.rows.find((r) => r.feature_type_name === 'sample_site');
    expect(dataset?.parent_submission_feature_id).to.be.null;
    expect(site?.parent_submission_feature_id).to.be.null;
  });

  it('should throw for unknown feature type during raw insert', async () => {
    const datasetId = randomUUID();

    const tarBuffer = await createTarBuffer([
      { name: '.dataset-id', content: datasetId },
      {
        name: 'features/dataset.json',
        content: JSON.stringify([
          {
            id: randomUUID(),
            type: 'nonexistent_type',
            properties: { name: 'Bad Feature' },
            content: [],
            parent: null
          }
        ])
      }
    ]);

    const { submissionId, uploadId, submissionUploadId, ticketId } = await setupSubmissionWithTar(tarBuffer);
    try {
      await service.ingestSubmissionUpload({
        submission_upload_id: submissionUploadId,
        submission_id: submissionId,
        upload_id: uploadId,
        status: 'pending',
        ticket_id: ticketId
      });
      expect.fail('Expected ingestion to throw for unknown feature type');
    } catch (error) {
      expect(String(error)).to.include('Failed to insert all submission feature records');
    }

    // Verify NO features were inserted (zero side effects from pass 1)
    const features = await connection.sql<{ count: string }>(
      SQL`SELECT count(*)::text as count FROM biohub.submission_feature WHERE submission_id = ${submissionId}`
    );
    expect(features.rows[0].count).to.equal('0');
  });

  it('should process media files and create artifact records', async () => {
    const datasetId = randomUUID();
    const datasetFeatureId = randomUUID();
    const fileFeatureId = randomUUID();

    const tarBuffer = await createTarBuffer([
      { name: '.dataset-id', content: datasetId },
      {
        name: 'features/dataset.json',
        content: JSON.stringify([
          {
            id: datasetFeatureId,
            type: 'dataset',
            properties: {
              name: 'Media Test Dataset',
              focal_species: [12345],
              start_date: '2024-01-01'
            },
            content: [fileFeatureId],
            parent: null
          }
        ])
      },
      {
        name: 'features/file.json',
        content: JSON.stringify([
          {
            id: fileFeatureId,
            type: 'file',
            properties: { filename: 'photo.jpg', file_size: 1024, file_type: 'image/jpeg' },
            content: [],
            parent: datasetFeatureId
          }
        ])
      },
      { name: 'files/photo.jpg', content: 'fake-image-bytes' }
    ]);

    const { submissionId, uploadId, submissionUploadId, ticketId } = await setupSubmissionWithTar(tarBuffer);
    const result = await service.ingestSubmissionUpload({
      submission_upload_id: submissionUploadId,
      submission_id: submissionId,
      upload_id: uploadId,
      status: 'pending',
      ticket_id: ticketId
    });

    // Track S3 media upload for cleanup
    s3KeysToCleanup.push(`submissions/${submissionId}/uploads/${submissionUploadId}/media/photo.jpg`);

    expect(result.valid).to.be.true;
    expect(result.errors).to.have.lengthOf(0);

    // Verify features were inserted (dataset + file)
    const features = await connection.sql<{ feature_type_name: string; data: Record<string, unknown> }>(
      SQL`SELECT ft.name as feature_type_name, sf.data
          FROM biohub.submission_feature sf
          JOIN biohub.feature_type ft ON sf.feature_type_id = ft.feature_type_id
          WHERE sf.submission_id = ${submissionId}
          ORDER BY ft.name`
    );

    const typeNames = features.rows.map((r) => r.feature_type_name);
    expect(typeNames).to.include('dataset');
    expect(typeNames).to.include('file');

    // Raw ingest keeps original feature payload shape.
    const fileFeature = features.rows.find((r) => r.feature_type_name === 'file');
    expect(fileFeature?.data).to.have.property('properties');
    expect((fileFeature?.data.properties as Record<string, unknown>)['filename']).to.equal('photo.jpg');

    // Verify media upload_artifact rows were created with persisted path values.
    const mediaUploadArtifacts = await connection.sql<{ path: string | null }>(
      SQL`SELECT ua.path
          FROM biohub.upload_artifact ua
          JOIN biohub.artifact a ON ua.artifact_id = a.artifact_id
          WHERE ua.upload_id = ${uploadId}
            AND a.object_key LIKE ${'submissions/' + submissionId + '/uploads/' + submissionUploadId + '/media/%'}`
    );
    expect(mediaUploadArtifacts.rows).to.have.lengthOf(1);
    expect(mediaUploadArtifacts.rows[0].path).to.equal('photo.jpg');
  });

  it('should ingest successfully when referenced media file is missing from tar', async () => {
    const datasetId = randomUUID();
    const datasetFeatureId = randomUUID();
    const fileFeatureId = randomUUID();

    const tarBuffer = await createTarBuffer([
      { name: '.dataset-id', content: datasetId },
      {
        name: 'features/dataset.json',
        content: JSON.stringify([
          {
            id: datasetFeatureId,
            type: 'dataset',
            properties: {
              name: 'Missing Media Dataset',
              focal_species: [12345],
              start_date: '2024-01-01'
            },
            content: [fileFeatureId],
            parent: null
          }
        ])
      },
      {
        name: 'features/file.json',
        content: JSON.stringify([
          {
            id: fileFeatureId,
            type: 'file',
            properties: { filename: 'missing.pdf', file_size: 2048, file_type: 'application/pdf' },
            content: [],
            parent: datasetFeatureId
          }
        ])
      }
      // No files/missing.pdf in archive
    ]);

    const { submissionId, uploadId, submissionUploadId, ticketId } = await setupSubmissionWithTar(tarBuffer);
    const result = await service.ingestSubmissionUpload({
      submission_upload_id: submissionUploadId,
      submission_id: submissionId,
      upload_id: uploadId,
      status: 'pending',
      ticket_id: ticketId
    });

    expect(result.valid).to.be.true;
    expect(result.errors).to.have.lengthOf(0);

    // Features are still ingested even if there were no media files in the tar.
    const features = await connection.sql<{ count: string }>(
      SQL`SELECT count(*)::text as count FROM biohub.submission_feature WHERE submission_id = ${submissionId}`
    );
    expect(features.rows[0].count).to.equal('2');
  });

  it('should persist unknown properties to JSONB without validation error', async () => {
    const datasetId = randomUUID();
    const featureId = randomUUID();

    const tarBuffer = await createTarBuffer([
      { name: '.dataset-id', content: datasetId },
      {
        name: 'features/dataset.json',
        content: JSON.stringify([
          {
            id: featureId,
            type: 'dataset',
            properties: {
              name: 'Unknown Props Test',
              focal_species: [12345],
              start_date: '2024-01-01',
              unknown_prop_a: 'should persist',
              unknown_prop_b: 42
            },
            content: [],
            parent: null
          }
        ])
      }
    ]);

    const { submissionId, uploadId, submissionUploadId, ticketId } = await setupSubmissionWithTar(tarBuffer);
    const result = await service.ingestSubmissionUpload({
      submission_upload_id: submissionUploadId,
      submission_id: submissionId,
      upload_id: uploadId,
      status: 'pending',
      ticket_id: ticketId
    });

    expect(result.valid).to.be.true;

    // Verify unknown properties are persisted under data.properties in raw payload.
    const features = await connection.sql<{ data: Record<string, unknown> }>(
      SQL`SELECT sf.data
          FROM biohub.submission_feature sf
          JOIN biohub.feature_type ft ON sf.feature_type_id = ft.feature_type_id
          WHERE sf.submission_id = ${submissionId} AND ft.name = 'dataset'`
    );

    expect(features.rows).to.have.lengthOf(1);

    const data = features.rows[0].data;
    expect(data).to.have.property('id', featureId);
    expect(data).to.have.property('type', 'dataset');
    expect(data).to.have.property('properties');
    const properties = data.properties as Record<string, unknown>;
    expect(properties).to.have.property('name', 'Unknown Props Test');
    expect(properties).to.have.property('focal_species');
    expect(properties).to.have.property('start_date');
    expect(properties).to.have.property('unknown_prop_a', 'should persist');
    expect(properties).to.have.property('unknown_prop_b', 42);
  });

  it('should throw on unknown feature types during raw insert', async () => {
    const datasetId = randomUUID();
    const duplicateId = randomUUID();

    const tarBuffer = await createTarBuffer([
      { name: '.dataset-id', content: datasetId },
      {
        name: 'features/dataset.json',
        content: JSON.stringify([
          {
            id: duplicateId,
            type: 'nonexistent_type_a',
            properties: { name: 'Bad 1' },
            content: [],
            parent: null
          },
          {
            id: duplicateId,
            type: 'nonexistent_type_b',
            properties: { name: 'Bad 2' },
            content: [],
            parent: null
          }
        ])
      }
    ]);

    const { submissionId, uploadId, submissionUploadId, ticketId } = await setupSubmissionWithTar(tarBuffer);
    try {
      await service.ingestSubmissionUpload({
        submission_upload_id: submissionUploadId,
        submission_id: submissionId,
        upload_id: uploadId,
        status: 'pending',
        ticket_id: ticketId
      });
      expect.fail('Expected ingestion to throw for unknown feature types');
    } catch (error) {
      expect(String(error)).to.include('Failed to insert all submission feature records');
    }
  });
});
