import { randomUUID } from 'node:crypto';
import SQL from 'sql-template-strings';
import { IDBConnection } from '../../database/db';

/**
 * Insert a minimal submission and return its ID.
 * Uses the connection user's system_user_id for foreign key references.
 */
export async function createTestSubmission(connection: IDBConnection): Promise<number> {
  const systemUserId = connection.systemUserId();

  await connection.sql(SQL`
    INSERT INTO contributor (client_id, description)
    SELECT 'SIMS', 'Integration test contributor'
    WHERE NOT EXISTS (
      SELECT 1
      FROM contributor
      WHERE client_id = 'SIMS'
        AND record_end_date IS NULL
    );
  `);

  const submissionTeamId = await createIntegrationSubmissionTeam(connection, systemUserId);

  const result = await connection.sql(SQL`
    INSERT INTO submission (uuid, system_user_id, team_id, contributor_id, name, description, comment, create_user)
    VALUES (
      gen_random_uuid(),
      ${systemUserId},
      ${submissionTeamId},
      (SELECT contributor_id FROM contributor WHERE client_id = 'SIMS' AND record_end_date IS NULL LIMIT 1),
      'Integration Test Submission',
      'Test description',
      'Test comment',
      ${systemUserId}
    )
    RETURNING submission_id;
  `);

  return result.rows[0].submission_id;
}

/**
 * Create a dedicated access team for an integration-test submission.
 */
export async function createIntegrationSubmissionTeam(
  connection: IDBConnection,
  systemUserId: number
): Promise<string> {
  const teamResult = await connection.sql(SQL`
    INSERT INTO team (name, description, create_user)
    VALUES (
      ${`Integration Submission Team ${randomUUID()}`},
      'Dedicated submission access team for integration testing.',
      ${systemUserId}
    )
    RETURNING team_id;
  `);
  const teamId = teamResult.rows[0].team_id as string;

  await connection.sql(SQL`
    INSERT INTO team_member (system_user_id, team_id, create_user)
    VALUES (${systemUserId}, ${teamId}, ${systemUserId});
  `);

  return teamId;
}

/**
 * Return the active default blueprint ID used by integration-test upload fixtures.
 *
 * `submission_upload.blueprint_id` is required, and most integration helpers only
 * need the seeded default blueprint rather than a custom per-test blueprint.
 */
export async function getActiveDefaultBlueprintId(connection: IDBConnection): Promise<number> {
  const result = await connection.sql(SQL`
    SELECT blueprint_id
    FROM blueprint
    WHERE is_default = true
      AND record_end_date IS NULL
    LIMIT 1;
  `);

  return result.rows[0].blueprint_id;
}

/**
 * Create a dedicated access team for an integration-test submission upload.
 */
export async function createIntegrationUploadTeam(
  connection: IDBConnection,
  uploadId: string,
  systemUserId: number
): Promise<string> {
  const teamResult = await connection.sql(SQL`
    INSERT INTO team (name, description, create_user)
    VALUES (
      ${`Integration Submission Upload Team ${uploadId}`},
      'Dedicated submission upload access team for integration testing.',
      ${systemUserId}
    )
    RETURNING team_id;
  `);
  const teamId = teamResult.rows[0].team_id as string;

  await connection.sql(SQL`
    INSERT INTO team_member (system_user_id, team_id, create_user)
    VALUES (${systemUserId}, ${teamId}, ${systemUserId});
  `);

  return teamId;
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

  const ticket_id = await getOrCreateIntegrationTicketId(connection, submissionId, uploadId, systemUserId);
  const teamId = await createIntegrationUploadTeam(connection, uploadId, systemUserId);
  const blueprintId = await getActiveDefaultBlueprintId(connection);

  const bridgeResult = await connection.sql(SQL`
    INSERT INTO submission_upload (submission_id, upload_id, team_id, ticket_id, blueprint_id, create_user)
    VALUES (
      ${submissionId},
      ${uploadId},
      ${teamId},
      ${ticket_id},
      ${blueprintId},
      ${systemUserId}
    )
    RETURNING submission_upload_id;
  `);
  const submissionUploadId = bridgeResult.rows[0].submission_upload_id;

  // Mark the upload as approved so features are eligible for security scope anchors
  await connection.sql(SQL`
    INSERT INTO submission_upload_status (submission_upload_id, status, create_user)
    VALUES (${submissionUploadId}, 'approved', ${systemUserId});
  `);

  const result = await connection.sql(SQL`
    INSERT INTO submission_feature (submission_id, submission_upload_id, feature_type_id, parent_submission_feature_id, data, data_byte_size, record_effective_date, create_user)
    VALUES (
      ${submissionId},
      ${submissionUploadId},
      (SELECT feature_type_id FROM feature_type WHERE name = ${featureTypeName} LIMIT 1),
      ${parentFeatureId ?? null},
      ${dataJson}::jsonb,
      octet_length(${dataJson}::jsonb::text) + 500,
      now(),
      ${systemUserId}
    )
    RETURNING submission_feature_id;
  `);

  return result.rows[0].submission_feature_id;
}

/**
 * Bulk-insert N submission_features sharing a single upload record.
 *
 * Uses generate_series for efficient insertion — ~5 queries regardless of N.
 * Designed for integration tests that need large candidate sets (e.g., testing
 * keyset-paginated anchor computation across multiple batches).
 *
 * All features share one upload record marked 'approved', so they are immediately
 * eligible for security scope anchor computation.
 *
 * @param connection Active database connection (transaction-scoped)
 * @param submissionId The submission to attach features to
 * @param featureTypeName Feature type name (must exist in seed data)
 * @param count Number of features to create
 * @param parentFeatureId Optional parent for all features (creates a flat tree under one root)
 * @returns submission_feature_ids in ascending order
 */
export async function createTestFeaturesInBulk(
  connection: IDBConnection,
  submissionId: number,
  featureTypeName: string,
  count: number,
  parentFeatureId?: number
): Promise<number[]> {
  const systemUserId = connection.systemUserId();

  // One upload record for the entire batch
  const uploadResult = await connection.sql(SQL`
    INSERT INTO upload (upload_status, record_end_date, create_user)
    VALUES ('completed', now(), ${systemUserId})
    RETURNING upload_id;
  `);
  const uploadId = uploadResult.rows[0].upload_id;

  const ticketId = await getOrCreateIntegrationTicketId(connection, submissionId, uploadId, systemUserId);
  const teamId = await createIntegrationUploadTeam(connection, uploadId, systemUserId);
  const blueprintId = await getActiveDefaultBlueprintId(connection);

  const bridgeResult = await connection.sql(SQL`
    INSERT INTO submission_upload (submission_id, upload_id, team_id, ticket_id, blueprint_id, create_user)
    VALUES (${submissionId}, ${uploadId}, ${teamId}, ${ticketId}, ${blueprintId}, ${systemUserId})
    RETURNING submission_upload_id;
  `);
  const submissionUploadId = bridgeResult.rows[0].submission_upload_id;

  await connection.sql(SQL`
    INSERT INTO submission_upload_status (submission_upload_id, status, create_user)
    VALUES (${submissionUploadId}, 'approved', ${systemUserId});
  `);

  // Bulk insert using generate_series — one query creates all N features
  const result = await connection.query<{ submission_feature_id: number }>(
    `INSERT INTO submission_feature (submission_id, submission_upload_id, feature_type_id, parent_submission_feature_id, data, data_byte_size, record_effective_date, create_user)
     SELECT
       $1::INTEGER,
       $2::UUID,
       (SELECT feature_type_id FROM feature_type WHERE name = $3 LIMIT 1),
       $4::INTEGER,
       ('{"name": "bulk-' || gs || '"}')::jsonb,
       520,
       now(),
       $5::INTEGER
     FROM generate_series(1, $6) AS gs
     RETURNING submission_feature_id`,
    [submissionId, submissionUploadId, featureTypeName, parentFeatureId ?? null, systemUserId, count]
  );

  return result.rows.map((r) => r.submission_feature_id);
}

/**
 * Insert one `submission_upload` plus N `submission_feature` rows under it, each row
 * parameterized by `(source_id, record_end_date, data?)`.
 *
 * Unlike `createTestFeaturesInBulk` — which inserts homogeneous features via
 * `generate_series` and is tuned for large counts — this helper supports
 * heterogeneous per-row data. Use it for tests that need control over
 * `source_id` and `record_end_date` to exercise NULL handling, soft-delete
 * semantics, or other per-row variation.
 *
 * @param connection Active database connection (transaction-scoped).
 * @param submissionId Submission to attach the upload and features to.
 * @param featureTypeName Feature type name (must exist in seed data).
 * @param features Per-row feature shapes. Empty array creates the upload with no features.
 * @returns The created `submission_upload_id`.
 */
export async function createTestUploadWithFeatures(
  connection: IDBConnection,
  submissionId: number,
  featureTypeName: string,
  features: Array<{
    source_id: string | null;
    record_end_date?: string | null;
    data?: Record<string, unknown>;
  }>
): Promise<string> {
  const systemUserId = connection.systemUserId();

  const uploadResult = await connection.sql(SQL`
    INSERT INTO upload (upload_status, record_end_date, create_user)
    VALUES ('completed', now(), ${systemUserId})
    RETURNING upload_id;
  `);
  const uploadId = uploadResult.rows[0].upload_id;

  const ticketId = await getOrCreateIntegrationTicketId(connection, submissionId, uploadId, systemUserId);
  const teamId = await createIntegrationUploadTeam(connection, uploadId, systemUserId);
  const blueprintId = await getActiveDefaultBlueprintId(connection);

  const bridgeResult = await connection.sql(SQL`
    INSERT INTO submission_upload (submission_id, upload_id, team_id, ticket_id, blueprint_id, create_user)
    VALUES (${submissionId}, ${uploadId}, ${teamId}, ${ticketId}, ${blueprintId}, ${systemUserId})
    RETURNING submission_upload_id;
  `);
  const submissionUploadId = bridgeResult.rows[0].submission_upload_id as string;

  if (features.length === 0) {
    return submissionUploadId;
  }

  const featureTypeResult = await connection.sql(SQL`
    SELECT feature_type_id FROM feature_type WHERE name = ${featureTypeName} LIMIT 1;
  `);
  const featureTypeId = featureTypeResult.rows[0].feature_type_id;

  for (const feature of features) {
    const dataJson = JSON.stringify(feature.data ?? {});
    await connection.sql(SQL`
      INSERT INTO submission_feature (
        submission_id,
        submission_upload_id,
        feature_type_id,
        source_id,
        record_end_date,
        data,
        data_byte_size,
        create_user
      )
      VALUES (
        ${submissionId},
        ${submissionUploadId},
        ${featureTypeId},
        ${feature.source_id},
        ${feature.record_end_date ?? null},
        ${dataJson}::jsonb,
        octet_length(${dataJson}::jsonb::text) + 500,
        ${systemUserId}
      );
    `);
  }

  return submissionUploadId;
}

/**
 * Get an existing integration ticket for a submission or create one if missing.
 *
 * This helper supports integration tests that insert into `submission_upload` directly now that
 * `submission_upload.ticket_id` is required. It is idempotent per submission by matching on a
 * stable subject + description pair.
 *
 * @param {IDBConnection} connection Active database connection used by the test.
 * @param {number} submissionId Submission primary key (`submission.submission_id`).
 * @param {string} uploadId Upload UUID (`upload.upload_id`).
 * @param {number} systemUserId System user id used for `create_user` fields.
 * @returns {Promise<string>} The `ticket.ticket_id` to associate with `submission_upload`.
 */
export async function getOrCreateIntegrationTicketId(
  connection: IDBConnection,
  submissionId: number,
  uploadId: string,
  systemUserId: number
): Promise<string> {
  const teamName = 'Integration Ticket Team';
  const subject = 'New Submission';

  const submissionResult = await connection.sql(SQL`
    SELECT uuid
    FROM submission
    WHERE submission_id = ${submissionId}
    LIMIT 1;
  `);

  const submissionUuid = submissionResult.rows[0]?.uuid as string | undefined;
  const description = `Submission ID: ${submissionId}. Submission UUID: ${
    submissionUuid ?? 'unknown'
  }. Upload UUID: ${uploadId}`;

  const existingTicket = await connection.sql(SQL`
    SELECT ticket_id
    FROM ticket
    WHERE subject = ${subject} AND description = ${description}
      AND record_end_date IS NULL
    LIMIT 1;
  `);

  const existingTicketId = existingTicket.rows[0]?.ticket_id as string | undefined;
  if (existingTicketId) {
    return existingTicketId;
  }

  const existingTeam = await connection.sql(SQL`
    SELECT team_id
    FROM team
    WHERE name = ${teamName}
      AND record_end_date IS NULL
    LIMIT 1;
  `);

  const existingTeamId = existingTeam.rows[0]?.team_id as string | undefined;
  const teamId =
    existingTeamId ??
    (
      await connection.sql(SQL`
        INSERT INTO team (name, description, create_user)
        VALUES (${teamName}, 'Integration test team for ticket linking.', ${systemUserId})
        RETURNING team_id;
      `)
    ).rows[0].team_id;

  const nextSlug = await connection.sql(SQL`
    WITH
      day_context AS (
        SELECT TO_CHAR((now() AT TIME ZONE 'UTC')::date, 'DDD') AS day_of_year
      ),
      latest AS (
        SELECT
          COALESCE(MAX(RIGHT(ticket_slug, 5)::integer), -1) AS last_value
        FROM ticket, day_context
        WHERE ticket_slug LIKE day_context.day_of_year || '%'
      ),
      next_value AS (
        SELECT
          day_context.day_of_year,
          latest.last_value + 1 AS next_sequence
        FROM day_context, latest
      )
    SELECT
      day_of_year || LPAD(next_sequence::text, 5, '0') AS ticket_slug
    FROM next_value;
  `);

  const ticketSlug = nextSlug.rows[0].ticket_slug as string;

  const createdTicket = await connection.sql(SQL`
    INSERT INTO ticket (
      ticket_slug,
      subject,
      description,
      team_id,
      priority,
      status,
      create_user
    )
    VALUES (
      ${ticketSlug},
      ${subject},
      ${description},
      ${teamId},
      'medium',
      'open',
      ${systemUserId}
    )
    RETURNING ticket_id;
  `);

  const ticketId = createdTicket.rows[0].ticket_id as string;

  await connection.sql(SQL`
    INSERT INTO ticket_status (ticket_id, status, create_user)
    VALUES (${ticketId}, 'open', ${systemUserId});
  `);

  return ticketId;
}
