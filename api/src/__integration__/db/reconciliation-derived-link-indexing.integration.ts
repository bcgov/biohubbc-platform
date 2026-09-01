// Integration coverage for rebuilding derived parent/content links from reconciliation staging.
//
// Run: docker compose exec api npm run test:mocha -- --no-config --extension ts \
//        'src/__integration__/db/reconciliation-derived-link-indexing.integration.ts'

import { expect } from 'chai';
import { describe } from 'mocha';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { FeatureIngestionRepository } from '../../repositories/ingestion/feature-ingestion-repository';
import { SubmissionFeatureErrorRepository } from '../../repositories/submission-feature-error-repository';
import { SubmissionFeaturePropertyIngestionRepository } from '../../repositories/submission-feature-property-ingestion-repository';
import { SubmissionRepository } from '../../repositories/submission-repository';
import { createTestUpload } from '../helpers/test-feature-property-helpers';
import { createTestSubmission } from '../helpers/test-submission-helpers';

describe('Reconciliation derived-link indexing (integration)', function () {
  this.timeout(15000);

  let connection: IDBConnection;

  before(() => initDBPool(defaultPoolConfig));

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
  });

  afterEach(async () => {
    await connection.rollback();
    connection.release();
  });

  async function insertStagedFeature(params: {
    submissionId: number;
    submissionUploadId: string;
    sourceId: string;
    data: Record<string, unknown>;
    reconciliation: 'new' | 'superseded';
    active: boolean;
  }): Promise<number> {
    const dataJson = JSON.stringify(params.data);
    const staged = await connection.sql(SQL`
      INSERT INTO submission_upload_feature (
        submission_upload_id,
        source_id,
        feature_type_id,
        data,
        data_byte_size,
        content_hash,
        reconciliation
      )
      VALUES (
        ${params.submissionUploadId}::uuid,
        ${params.sourceId},
        (SELECT feature_type_id FROM feature_type WHERE name = 'survey' LIMIT 1),
        ${dataJson}::jsonb,
        octet_length(${dataJson}::jsonb::text),
        encode(sha256(convert_to(${dataJson}, 'UTF8')), 'hex'),
        ${params.reconciliation}
      )
      RETURNING submission_upload_feature_id, content_hash;
    `);

    const feature = await connection.sql(SQL`
      INSERT INTO submission_feature (
        submission_id,
        submission_upload_id,
        submission_upload_feature_id,
        source_id,
        feature_type_id,
        data,
        data_byte_size,
        content_hash,
        record_effective_date
      )
      VALUES (
        ${params.submissionId},
        ${params.submissionUploadId}::uuid,
        ${staged.rows[0].submission_upload_feature_id}::uuid,
        ${params.sourceId},
        (SELECT feature_type_id FROM feature_type WHERE name = 'survey' LIMIT 1),
        ${dataJson}::jsonb,
        octet_length(${dataJson}::jsonb::text),
        ${staged.rows[0].content_hash},
        CASE WHEN ${params.active} THEN now() ELSE NULL END
      )
      RETURNING submission_feature_id;
    `);

    await connection.sql(SQL`
      UPDATE submission_upload_feature
      SET submission_feature_id = ${feature.rows[0].submission_feature_id}
      WHERE submission_upload_feature_id = ${staged.rows[0].submission_upload_feature_id}::uuid;
    `);

    return feature.rows[0].submission_feature_id;
  }

  it('stores reconciliation error details', async () => {
    const submissionId = await createTestSubmission(connection);
    const uploadId = await createTestUpload(connection, submissionId);

    await insertStagedFeature({
      submissionId,
      submissionUploadId: uploadId,
      sourceId: 'duplicate-source',
      data: {},
      reconciliation: 'new',
      active: false
    });
    await connection.sql(SQL`
      UPDATE submission_upload_feature
      SET
        reconciliation = 'conflict',
        metadata = jsonb_build_object('reason', 'duplicate_source_id')
      WHERE submission_upload_id = ${uploadId}::uuid;
    `);

    const repository = new SubmissionFeatureErrorRepository(connection);
    await repository.insertSubmissionFeatureErrorForSubmissionUploadId(uploadId);

    const result = await connection.sql(SQL`
      SELECT error_code, count, details
      FROM submission_feature_error
      WHERE submission_upload_id = ${uploadId}::uuid
      ORDER BY error_code;
    `);

    expect(result.rows).to.deep.equal([
      {
        error_code: 'DUPLICATE_FEATURE_SOURCE_ID',
        count: 1,
        details: { source_id: 'duplicate-source' }
      },
      {
        error_code: 'RECONCILIATION_CONFLICT',
        count: 1,
        details: { reasons: ['duplicate_source_id'] }
      }
    ]);
  });

  it('repoints an unchanged source when its parent/content target is superseded', async () => {
    const submissionId = await createTestSubmission(connection);
    const baselineUploadId = await createTestUpload(connection, submissionId);
    const currentUploadId = await createTestUpload(connection, submissionId);

    const baselineParentId = await insertStagedFeature({
      submissionId,
      submissionUploadId: baselineUploadId,
      sourceId: 'parent',
      data: {},
      reconciliation: 'new',
      active: true
    });
    const unchangedChildId = await insertStagedFeature({
      submissionId,
      submissionUploadId: baselineUploadId,
      sourceId: 'child',
      data: { parent: 'parent', content: ['parent'] },
      reconciliation: 'new',
      active: true
    });
    await connection.sql(SQL`
      UPDATE submission_feature
      SET parent_submission_feature_id = ${baselineParentId}
      WHERE submission_feature_id = ${unchangedChildId};
    `);
    await connection.sql(SQL`
      INSERT INTO submission_feature_feature (source_feature_id, target_feature_id)
      VALUES (${unchangedChildId}, ${baselineParentId});
    `);

    const replacementParentId = await insertStagedFeature({
      submissionId,
      submissionUploadId: currentUploadId,
      sourceId: 'parent',
      data: { version: 2 },
      reconciliation: 'superseded',
      active: false
    });
    await connection.sql(SQL`
      INSERT INTO submission_upload_feature (
        submission_upload_id,
        source_id,
        submission_feature_id,
        feature_type_id,
        data,
        data_byte_size,
        content_hash,
        reconciliation
      )
      SELECT
        ${currentUploadId}::uuid,
        source_id,
        submission_feature_id,
        feature_type_id,
        data,
        data_byte_size,
        content_hash,
        'unchanged'
      FROM submission_feature
      WHERE submission_feature_id = ${unchangedChildId};
    `);

    const propertyRepository = new SubmissionFeaturePropertyIngestionRepository(connection);
    await propertyRepository.recordUnresolvedParentErrorsBySubmissionUploadId(currentUploadId, submissionId);
    await propertyRepository.recordReferenceErrorsBySubmissionUploadId(currentUploadId, submissionId);

    const validationErrors = await connection.sql(SQL`
      SELECT COUNT(*)::integer AS count
      FROM submission_feature_error
      WHERE submission_upload_id = ${currentUploadId}::uuid;
    `);
    expect(validationErrors.rows[0].count).to.equal(0);

    const submissionRepository = new SubmissionRepository(connection);
    const featureRepository = new FeatureIngestionRepository(connection);
    await submissionRepository.deleteSubmissionFeatureRelationshipsBySubmissionUploadId(currentUploadId);
    await featureRepository.updateSubmissionFeatureParentsBySubmissionUploadId(currentUploadId, submissionId);
    await propertyRepository.insertFeatureRelationshipsBySubmissionUploadId(currentUploadId, submissionId);

    const child = await connection.sql(SQL`
      SELECT parent_submission_feature_id
      FROM submission_feature
      WHERE submission_feature_id = ${unchangedChildId};
    `);
    expect(child.rows[0].parent_submission_feature_id).to.equal(replacementParentId);

    const relationships = await connection.sql(SQL`
      SELECT target_feature_id
      FROM submission_feature_feature
      WHERE source_feature_id = ${unchangedChildId};
    `);
    expect(relationships.rows).to.deep.equal([{ target_feature_id: replacementParentId }]);
  });
});
