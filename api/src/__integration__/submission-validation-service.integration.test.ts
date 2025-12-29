/**
 * Integration tests for submission validation tracking and publishing flow.
 * Uses the real dev PostgreSQL database.
 *
 * Prerequisites:
 *   - Database running (make web or make backend)
 *   - .env file configured
 *
 * Run with:
 *   npm run test:integration
 */

/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path');
// Load .env from biohubbc-platform folder (parent of api/) BEFORE any imports
require('dotenv').config({ path: path.resolve(process.cwd(), '../.env') });

// Override DB host for local execution outside Docker
process.env.DB_HOST = 'localhost';

import { expect } from 'chai';
import { describe, it } from 'mocha';
import pg from 'pg';
import SQL from 'sql-template-strings';
import { getAPIUserDBConnection, initDBPool } from '../database/db';
import { getPgBoss, initPgBoss } from '../queue/pg-boss-service';
import { publishProcessSubmissionFeaturesJob } from '../queue/publisher';
import { ISubmissionFeature } from '../repositories/submission-repository';
import { SubmissionService } from '../services/submission-service';
import { SubmissionValidationService } from '../services/submission-validation-service';
import { ValidationService } from '../services/validation-service';

// Create pool config AFTER dotenv has loaded env vars
const integrationPoolConfig: pg.PoolConfig = {
  user: process.env.DB_USER_API,
  password: process.env.DB_USER_API_PASS,
  database: process.env.DB_DATABASE,
  port: Number(process.env.DB_PORT),
  host: 'localhost',
  max: 10
};

// Helper function to create FeatureCollection geometry (required format for 'spatial' type)
const makeGeometry = (coords: [number, number]) => ({
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Point',
        coordinates: coords
      }
    }
  ]
});

// Generate a random UUID
const randomUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

describe('SubmissionValidationService Integration', () => {
  before(async function () {
    this.timeout(10000);
    initDBPool(integrationPoolConfig);
    await initPgBoss();
  });

  after(async function () {
    this.timeout(5000);
    const boss = getPgBoss();
    if (boss) {
      await boss.stop();
    }
  });

  describe('publishProcessSubmissionFeaturesJob', () => {
    it('creates a submission, publishes a job, and creates submission validation record', async function () {
      this.timeout(30000);

      const connection = getAPIUserDBConnection();
      let opened = false;

      try {
        await connection.open();
        opened = true;

        const submissionService = new SubmissionService(connection);
        const validationService = new ValidationService(connection);

        // Sample submission data
        const sampleSubmission = {
          uuid: randomUUID(),
          name: 'Integration Test Survey',
          description: 'A test submission for integration testing',
          comment: 'Integration test comment'
        };

        const sampleFeature: ISubmissionFeature = {
          id: 'dataset-integration-test',
          type: 'dataset',
          properties: {
            name: 'Integration Test Dataset',
            start_date: '2024-01-01T00:00:00Z',
            end_date: '2024-12-31T00:00:00Z',
            focal_species: [100001],
            geometry: makeGeometry([-123.37, 48.42])
          },
          child_features: [
            {
              id: 'sample-site-integration',
              type: 'sample_site',
              properties: {
                name: 'Integration Test Site',
                description: 'Test sample site',
                geometry: makeGeometry([-123.35, 48.4])
              },
              child_features: []
            }
          ]
        };

        // 1. Validate submission
        await validationService.validateSubmissionFeatureShape([sampleFeature]);

        // 2. Insert submission record
        const submissionRecord = await submissionService.insertSubmissionRecordWithPotentialConflict({
          uuid: sampleSubmission.uuid,
          quarantine_id: null,
          name: sampleSubmission.name,
          description: sampleSubmission.description,
          comment: sampleSubmission.comment,
          system_user_id: 1, // API user
          source_system: 'integration-test'
        });

        expect(submissionRecord.submission_id).to.be.a('number');
        expect(submissionRecord.uuid).to.equal(sampleSubmission.uuid);

        // 3. Insert feature records
        await submissionService.insertSubmissionFeatureRecords(submissionRecord.submission_id, [sampleFeature]);

        // 4. Publish job (publisher handles submission validation tracking internally)
        const result = await publishProcessSubmissionFeaturesJob(connection, {
          submissionId: submissionRecord.submission_id
        });

        expect(result.status).to.equal('published');
        const jobId = (result as { status: 'published'; jobId: string }).jobId;
        expect(jobId).to.be.a('string');
        expect(jobId).to.have.lengthOf(36); // UUID format

        // 5. Verify submission validation record was created
        const validationResult = await connection.sql<{ submission_validation_id: number; status: string }>(SQL`
          SELECT submission_validation_id, status
          FROM submission_validation
          WHERE job_id = ${jobId}::uuid
        `);

        expect(validationResult.rowCount).to.equal(1);
        expect(validationResult.rows[0].status).to.equal('pending');

        // 6. Verify pg-boss job exists
        const pgBossResult = await connection.sql<{ id: string; state: string }>(SQL`
          SELECT id, state
          FROM pgboss.job
          WHERE id = ${jobId}::uuid
        `);

        expect(pgBossResult.rowCount).to.equal(1);
        expect(pgBossResult.rows[0].state).to.equal('created');

        // Rollback to clean up test data
        await connection.rollback();
      } catch (error) {
        if (opened) {
          await connection.rollback();
        }
        throw error;
      } finally {
        connection.release();
      }
    });

    it('updates validation status correctly', async function () {
      this.timeout(15000);

      const connection = getAPIUserDBConnection();

      try {
        await connection.open();

        const submissionService = new SubmissionService(connection);
        const validationService = new ValidationService(connection);
        const submissionValidationService = new SubmissionValidationService(connection);

        const sampleSubmission = {
          uuid: randomUUID(),
          name: 'Status Update Test Survey',
          description: 'Testing validation status updates',
          comment: 'Status test'
        };

        const sampleFeature: ISubmissionFeature = {
          id: 'dataset-status-test',
          type: 'dataset',
          properties: {
            name: 'Status Test Dataset',
            start_date: '2024-01-01T00:00:00Z',
            end_date: '2024-12-31T00:00:00Z',
            focal_species: [100001],
            geometry: makeGeometry([-123.37, 48.42])
          },
          child_features: []
        };

        // Create submission and publish job
        await validationService.validateSubmissionFeatureShape([sampleFeature]);

        const submissionRecord = await submissionService.insertSubmissionRecordWithPotentialConflict({
          uuid: sampleSubmission.uuid,
          quarantine_id: null,
          name: sampleSubmission.name,
          description: sampleSubmission.description,
          comment: sampleSubmission.comment,
          system_user_id: 1,
          source_system: 'integration-test'
        });

        await submissionService.insertSubmissionFeatureRecords(submissionRecord.submission_id, [sampleFeature]);

        const result = await publishProcessSubmissionFeaturesJob(connection, {
          submissionId: submissionRecord.submission_id
        });

        expect(result.status).to.equal('published');
        const jobId = (result as { status: 'published'; jobId: string }).jobId;
        expect(jobId).to.be.a('string');

        // Update status to 'started'
        await submissionValidationService.updateSubmissionValidationStatus(jobId, 'started');

        const startedResult = await connection.sql<{ status: string; started_at: string | null }>(SQL`
          SELECT status, started_at FROM submission_validation WHERE job_id = ${jobId}::uuid
        `);

        expect(startedResult.rows[0].status).to.equal('started');
        expect(startedResult.rows[0].started_at).to.not.be.null;

        // Update status to 'completed'
        await submissionValidationService.updateSubmissionValidationStatus(jobId, 'completed');

        const completedResult = await connection.sql<{ status: string; ended_at: string | null }>(SQL`
          SELECT status, ended_at FROM submission_validation WHERE job_id = ${jobId}::uuid
        `);

        expect(completedResult.rows[0].status).to.equal('completed');
        expect(completedResult.rows[0].ended_at).to.not.be.null;

        // Rollback to clean up
        await connection.rollback();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    });
  });
});
