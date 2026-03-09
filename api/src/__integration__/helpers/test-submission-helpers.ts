import SQL from 'sql-template-strings';
import { IDBConnection } from '../../database/db';

/**
 * Insert a minimal submission and return its ID.
 * Uses the connection user's system_user_id for foreign key references.
 */
export async function createTestSubmission(connection: IDBConnection): Promise<number> {
  const systemUserId = connection.systemUserId();

  const result = await connection.sql(SQL`
    INSERT INTO submission (uuid, system_user_id, source_system, name, description, comment, create_user)
    VALUES (gen_random_uuid(), ${systemUserId}, 'SIMS', 'Integration Test Submission', 'Test description', 'Test comment', ${systemUserId})
    RETURNING submission_id;
  `);

  return result.rows[0].submission_id;
}

/**
 * Insert a submission_feature and return its ID.
 * Creates a temporary upload record for the FK constraint, then inserts the feature.
 * Looks up feature_type by name from the pre-seeded feature_type table.
 */
export async function createTestFeature(
  connection: IDBConnection,
  submissionId: number,
  featureTypeName: string,
  data: Record<string, unknown>,
  parentFeatureId?: number
): Promise<number> {
  const systemUserId = connection.systemUserId();
  const dataJson = JSON.stringify(data);

  const uploadResult = await connection.sql(SQL`
    INSERT INTO upload (upload_status, record_end_date, create_user)
    VALUES ('completed', now(), ${systemUserId})
    RETURNING upload_id;
  `);
  const uploadId = uploadResult.rows[0].upload_id;

  const bridgeResult = await connection.sql(SQL`
    INSERT INTO submission_upload (submission_id, upload_id, create_user)
    VALUES (${submissionId}, ${uploadId}, ${systemUserId})
    RETURNING submission_upload_id;
  `);
  const submissionUploadId = bridgeResult.rows[0].submission_upload_id;

  const result = await connection.sql(SQL`
    INSERT INTO submission_feature (submission_id, submission_upload_id, feature_type_id, parent_submission_feature_id, data, data_byte_size, create_user)
    VALUES (
      ${submissionId},
      ${submissionUploadId},
      (SELECT feature_type_id FROM feature_type WHERE name = ${featureTypeName} LIMIT 1),
      ${parentFeatureId ?? null},
      ${dataJson}::jsonb,
      octet_length(${dataJson}::jsonb::text) + 500,
      ${systemUserId}
    )
    RETURNING submission_feature_id;
  `);

  return result.rows[0].submission_feature_id;
}
