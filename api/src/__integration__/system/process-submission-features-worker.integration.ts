// Integration test for process-submission-features pg-boss worker (full flow).
//
// Run: make test-sys
// Requires: make web && make queue
import { expect } from 'chai';
import { Knex, knex } from 'knex';
import { randomUUID } from 'node:crypto';
import * as tar from 'tar-stream';
import { getOrCreateIntegrationTicketId } from '../helpers/test-submission-helpers';
import { defaultPoolConfig, getAPIUserDBConnection, initDBPool } from '../../database/db';
import { JobQueues } from '../../queue/jobs';
import { getPgBoss, initPgBoss, stopPgBoss } from '../../queue/pg-boss-service';
import { publishProcessSubmissionFeaturesJob } from '../../queue/publisher';
import { BucketType, ObjectStorageService } from '../../services/object-storage/object-storage-service';

const TEST_PREFIX = '__integration-test__';
const SYSTEM_USER_ID = 2; // biohub_api system user

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

async function waitForSubmissionUploadStatus(
  db: Knex,
  submissionUploadId: string,
  timeoutMs = 30000
): Promise<{ status: string }> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const [row] = await db('biohub.submission_upload')
      .where('submission_upload_id', submissionUploadId)
      .select('status')
      .limit(1);
    if (row && ['succeeded', 'invalid', 'failed'].includes(row.status)) {
      return row;
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
  const createdObjectKeys: string[] = [];
  const createdContributorIds: number[] = [];
  const createdContributorSystemUserIds: number[] = [];
  let hasArtifactPropertyTable = false;

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

    // Ensure the test system user is mapped to an active contributor, which
    // codeset ingestion now requires when resolving contributor-scoped codes.
    const existingContributorLink = await db('biohub.contributor_system_user as csu')
      .join('biohub.contributor as c', 'c.contributor_id', 'csu.contributor_id')
      .where('csu.system_user_id', SYSTEM_USER_ID)
      .whereNull('csu.record_end_date')
      .whereNull('c.record_end_date')
      .select('csu.contributor_system_user_id', 'c.contributor_id')
      .first();

    if (!existingContributorLink) {
      const contributorClientId = `${TEST_PREFIX}-contributor`;
      let contributor = await db('biohub.contributor')
        .where('client_id', contributorClientId)
        .whereNull('record_end_date')
        .select('contributor_id')
        .first();

      if (!contributor) {
        const [insertedContributor] = await db('biohub.contributor')
          .insert({
            client_id: contributorClientId,
            description: 'Integration test contributor',
            create_user: SYSTEM_USER_ID
          })
          .returning('contributor_id');
        contributor = insertedContributor;
        createdContributorIds.push(insertedContributor.contributor_id);
      }

      const [insertedLink] = await db('biohub.contributor_system_user')
        .insert({
          contributor_id: contributor.contributor_id,
          system_user_id: SYSTEM_USER_ID,
          create_user: SYSTEM_USER_ID
        })
        .returning('contributor_system_user_id');

      createdContributorSystemUserIds.push(insertedLink.contributor_system_user_id);
    }

    await initPgBoss();
    hasArtifactPropertyTable = await db.schema.withSchema('biohub').hasTable('submission_feature_property_artifact');

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
        // submission_feature_property_* tables FK to submission_feature — delete first
        const featureIds = await db('biohub.submission_feature')
          .where('submission_id', submissionId)
          .select('submission_feature_id');
        const ids = featureIds.map((r: { submission_feature_id: number }) => r.submission_feature_id);
        if (ids.length) {
          await db('biohub.submission_feature_property_string').whereIn('submission_feature_id', ids).del();
          await db('biohub.submission_feature_property_number').whereIn('submission_feature_id', ids).del();
          await db('biohub.submission_feature_property_boolean').whereIn('submission_feature_id', ids).del();
          await db('biohub.submission_feature_property_timestamp').whereIn('submission_feature_id', ids).del();
          await db('biohub.submission_feature_property_code').whereIn('submission_feature_id', ids).del();
          await db('biohub.submission_feature_property_taxon').whereIn('submission_feature_id', ids).del();
          await db('biohub.submission_feature_property_geometry').whereIn('submission_feature_id', ids).del();
          await db('biohub.submission_feature_feature')
            .whereIn('source_feature_id', ids)
            .orWhereIn('target_feature_id', ids)
            .del();
          if (hasArtifactPropertyTable) {
            await db('biohub.submission_feature_property_artifact').whereIn('submission_feature_id', ids).del();
          }
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

      if (createdContributorSystemUserIds.length) {
        await db('biohub.contributor_system_user')
          .whereIn('contributor_system_user_id', createdContributorSystemUserIds)
          .del();
      }

      if (createdContributorIds.length) {
        await db('biohub.contributor').whereIn('contributor_id', createdContributorIds).del();
      }

      for (const submissionId of createdSubmissionIds) {
        await db('biohub.submission').where('submission_id', submissionId).del();
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

    // 1. submission (uuid, system_user_id, source_system, name, description, comment required)
    const [submission] = await db('biohub.submission')
      .insert({
        uuid: randomUUID(),
        system_user_id: SYSTEM_USER_ID,
        source_system: 'SIMS',
        name: TEST_PREFIX,
        description: TEST_PREFIX,
        comment: TEST_PREFIX,
        // Active rows in this schema are modeled with a future end date.
        record_end_date: new Date(Date.now() + 30 * 60 * 1000).toISOString()
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

    // 5. submission_upload (links submission to upload)
    const dbConnection = getAPIUserDBConnection();
    await dbConnection.open();

    let ticketId: string;
    try {
      ticketId = await getOrCreateIntegrationTicketId(
        dbConnection,
        submission.submission_id,
        upload.upload_id,
        SYSTEM_USER_ID
      );
      await dbConnection.commit();
    } catch (error) {
      await dbConnection.rollback();
      throw error;
    } finally {
      dbConnection.release();
    }

    const [submissionUpload] = await db('biohub.submission_upload')
      .insert({
        submission_id: submission.submission_id,
        upload_id: upload.upload_id,
        status: 'pending',
        ticket_id: ticketId,
        record_end_date: new Date(Date.now() + 30 * 60 * 1000).toISOString()
      })
      .returning('submission_upload_id');

    // 6. upload_artifact (required for JOIN in getSubmissionUploadsBySubmissionId)
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

  it('should mark submission as invalid for unknown feature type', async () => {
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
            properties: { name: 'Bad Feature', start_date: '2024-01-01' },
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

    const uploadStatus = await waitForSubmissionUploadStatus(db, submissionUploadId);
    expect(uploadStatus.status).to.equal('failed');
  });

  it('should run full ingestion plus indexing and set submission_upload status to succeeded', async () => {
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
              name: 'Worker Success Dataset',
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
            properties: { name: 'Site A' },
            content: [],
            parent: datasetFeatureId
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

    const uploadStatus = await waitForSubmissionUploadStatus(db, submissionUploadId);
    expect(uploadStatus.status).to.equal('succeeded');

    const relationshipRows = await db('biohub.submission_feature_feature as sff')
      .join('biohub.submission_feature as source_sf', 'source_sf.submission_feature_id', 'sff.source_feature_id')
      .where('source_sf.submission_upload_id', submissionUploadId)
      .count<{ count: string }[]>('* as count');
    expect(Number(relationshipRows[0].count)).to.be.greaterThan(0);

    const parentRows = await db('biohub.submission_feature')
      .where('submission_upload_id', submissionUploadId)
      .whereNotNull('parent_submission_feature_id')
      .count<{ count: string }[]>('* as count');
    expect(Number(parentRows[0].count)).to.be.greaterThan(0);
  });

  it('should mark submission_upload invalid when indexing cannot resolve parent references', async () => {
    const datasetId = randomUUID();
    const datasetFeatureId = randomUUID();
    const orphanFeatureId = randomUUID();

    const tarBuffer = await createTarBuffer([
      { name: '.dataset-id', content: datasetId },
      {
        name: 'features/dataset.json',
        content: JSON.stringify([
          {
            id: datasetFeatureId,
            type: 'dataset',
            properties: {
              name: 'Worker Invalid Parent Dataset',
              start_date: '2024-01-01'
            },
            content: [orphanFeatureId],
            parent: null
          }
        ])
      },
      {
        name: 'features/sample_site.json',
        content: JSON.stringify([
          {
            id: orphanFeatureId,
            type: 'sample_site',
            properties: { name: 'Orphan Site' },
            content: [],
            parent: 'missing-parent-id'
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

    const uploadStatus = await waitForSubmissionUploadStatus(db, submissionUploadId);
    expect(uploadStatus.status).to.equal('invalid');
  });
});
