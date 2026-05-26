import crypto from 'crypto';
import SQL from 'sql-template-strings';
import { IDBConnection } from '../../database/db';
import { getOrCreateIntegrationTicketId } from './test-submission-helpers';

// Shared fixtures for the feature-property ingestion integration suites
// (submission-feature-property-ingestion-repository + submission-feature-property-feature-ingestion).
// These mint the catalog config and submission_upload scaffolding both suites need, and read back the
// canonical/error tables they assert on.

/**
 * Create a real `submission_upload` row for a submission and return its `submission_upload_id` uuid.
 *
 * `submission_feature_error` and `submission_feature` both FK to `submission_upload`, so tests that
 * write those need a real upload uuid (a bare random uuid violates the FK). Unlike
 * `createTestFeature`, this mints the upload only — letting callers insert features with explicit
 * source_ids into the same upload.
 */
export async function createTestUpload(connection: IDBConnection, submissionId: number): Promise<string> {
  const systemUserId = connection.systemUserId();

  const uploadResult = await connection.sql(SQL`
    INSERT INTO upload (upload_status, record_end_date, create_user)
    VALUES ('completed', now(), ${systemUserId})
    RETURNING upload_id;
  `);
  const uploadId = uploadResult.rows[0].upload_id;

  const ticketId = await getOrCreateIntegrationTicketId(connection, submissionId, uploadId, systemUserId);

  const bridgeResult = await connection.sql(SQL`
    INSERT INTO submission_upload (submission_id, upload_id, ticket_id, create_user)
    VALUES (${submissionId}, ${uploadId}, ${ticketId}, ${systemUserId})
    RETURNING submission_upload_id;
  `);

  return bridgeResult.rows[0].submission_upload_id;
}

/** Resolve a seeded feature_type by name to its id. */
export async function featureTypeIdByName(connection: IDBConnection, name: string): Promise<number> {
  const result = await connection.sql(SQL`
    SELECT feature_type_id FROM feature_type WHERE name = ${name} LIMIT 1;
  `);
  return result.rows[0].feature_type_id;
}

/**
 * Create a synthetic `feature`-typed feature_property and assign it to a source feature type via
 * feature_type_property, then declare its allowed target feature types in
 * `feature_type_property_feature`. Idempotently ensures the 'feature' feature_property_type exists,
 * so each suite is self-contained.
 *
 * @param sourceFeatureTypeName Feature type the property is attached to (the referencing feature).
 * @param allowedTargetFeatureTypeNames Allowed target feature type name(s). Pass a single string,
 *   an array of names, or null for "no permitted target".
 * @param allowMultiple Whether the property may carry multiple references.
 * @returns The new feature_type_property_id, the resolved allowed feature_type_ids (empty when no
 *   targets), and the feature_property.name to use as the data.properties key on source features.
 */
export async function createFeatureTypeProperty(
  connection: IDBConnection,
  sourceFeatureTypeName: string,
  allowedTargetFeatureTypeNames: string | string[] | null,
  allowMultiple = false
): Promise<{ featureTypePropertyId: number; allowedFeatureTypeIds: number[]; propertyName: string }> {
  const systemUserId = connection.systemUserId();

  await connection.sql(SQL`
    INSERT INTO feature_property_type (name, record_effective_date, create_user)
    SELECT 'feature', now(), ${systemUserId}
    WHERE NOT EXISTS (SELECT 1 FROM feature_property_type WHERE name = 'feature');
  `);

  const fptResult = await connection.sql(SQL`
    SELECT feature_property_type_id FROM feature_property_type WHERE name = 'feature';
  `);
  const featurePropertyTypeId = fptResult.rows[0].feature_property_type_id;

  const uniqueSuffix = crypto.randomInt(0, 1_000_000_000);
  const propertyName = `test_feature_ref_${uniqueSuffix}`;
  const fpResult = await connection.sql(SQL`
    INSERT INTO feature_property (feature_property_type_id, name, display_name, record_effective_date, create_user)
    VALUES (${featurePropertyTypeId}, ${propertyName}, ${'Test Feature Ref ' + uniqueSuffix}, now(), ${systemUserId})
    RETURNING feature_property_id;
  `);
  const featurePropertyId = fpResult.rows[0].feature_property_id;

  const ftpResult = await connection.sql(SQL`
    INSERT INTO feature_type_property (
      feature_type_id,
      feature_property_id,
      allow_multiple,
      record_effective_date,
      create_user
    )
    VALUES (
      (SELECT feature_type_id FROM feature_type WHERE name = ${sourceFeatureTypeName} LIMIT 1),
      ${featurePropertyId},
      ${allowMultiple},
      now(),
      ${systemUserId}
    )
    RETURNING feature_type_property_id;
  `);
  const featureTypePropertyId: number = ftpResult.rows[0].feature_type_property_id;

  const targetNames =
    allowedTargetFeatureTypeNames === null
      ? []
      : Array.isArray(allowedTargetFeatureTypeNames)
      ? allowedTargetFeatureTypeNames
      : [allowedTargetFeatureTypeNames];

  const allowedFeatureTypeIds: number[] = [];
  for (const targetName of targetNames) {
    const targetId = await featureTypeIdByName(connection, targetName);
    allowedFeatureTypeIds.push(targetId);
    await connection.sql(SQL`
      INSERT INTO feature_type_property_feature (
        feature_type_property_id,
        target_feature_type_id,
        create_user
      )
      VALUES (${featureTypePropertyId}, ${targetId}, ${systemUserId});
    `);
  }

  return { featureTypePropertyId, allowedFeatureTypeIds, propertyName };
}

/**
 * Fetch grouped error rows for an upload, ordered by code.
 *
 * @param positiveCountsOnly When true, drops count-0 rows. The engine writes a benign count-0
 *   `UNRESOLVED_PARENT` diagnostic row for every feature, and the Phase 9 fail-fast gate keys off
 *   `SUM(count)`, so only count > 0 rows are upload-blocking. The repository-level suite drives
 *   methods in isolation (no diagnostic rows) and reads all rows.
 */
export async function getSubmissionFeatureErrors(
  connection: IDBConnection,
  uploadId: string,
  positiveCountsOnly = false
): Promise<{ error_code: string; count: number }[]> {
  const query = SQL`
    SELECT error_code, count
    FROM submission_feature_error
    WHERE submission_upload_id = ${uploadId}::uuid
  `;
  if (positiveCountsOnly) {
    query.append(SQL` AND count > 0`);
  }
  query.append(SQL` ORDER BY error_code;`);

  const result = await connection.sql(query);
  return result.rows;
}

/** Fetch canonical property-feature rows for a source feature, ordered by referenced feature. */
export async function getPropertyFeatureRows(
  connection: IDBConnection,
  sourceFeatureId: number
): Promise<{ referenced_submission_feature_id: number; feature_type_property_id: number }[]> {
  const result = await connection.sql(SQL`
    SELECT referenced_submission_feature_id, feature_type_property_id
    FROM submission_feature_property_feature
    WHERE submission_feature_id = ${sourceFeatureId}
    ORDER BY referenced_submission_feature_id;
  `);
  return result.rows;
}
