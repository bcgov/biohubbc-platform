import crypto from 'crypto';
import SQL from 'sql-template-strings';
import { IDBConnection } from '../../database/db';
import {
  createIntegrationUploadTeam,
  getActiveDefaultBlueprintId,
  getOrCreateIntegrationTicketId
} from './test-submission-helpers';

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
  const teamId = await createIntegrationUploadTeam(connection, uploadId, systemUserId);
  const blueprintId = await getActiveDefaultBlueprintId(connection);

  const bridgeResult = await connection.sql(SQL`
    INSERT INTO submission_upload (submission_id, upload_id, team_id, ticket_id, blueprint_id, create_user)
    VALUES (${submissionId}, ${uploadId}, ${teamId}, ${ticketId}, ${blueprintId}, ${systemUserId})
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

  const bftResult = await connection.sql(SQL`
    WITH inserted AS (
      INSERT INTO blueprint_feature_type (
        blueprint_id,
        feature_type_id,
        create_user
      )
      VALUES (
        (SELECT blueprint_id FROM blueprint WHERE is_default = true AND record_end_date IS NULL LIMIT 1),
        (SELECT feature_type_id FROM feature_type WHERE name = ${sourceFeatureTypeName} LIMIT 1),
        ${systemUserId}
      )
      ON CONFLICT (blueprint_id, feature_type_id)
      WHERE record_end_date IS NULL
      DO NOTHING
      RETURNING blueprint_feature_type_id
    )
    SELECT blueprint_feature_type_id FROM inserted
    UNION ALL
    SELECT bft.blueprint_feature_type_id
    FROM blueprint_feature_type bft
    JOIN blueprint b USING (blueprint_id)
    JOIN feature_type ft USING (feature_type_id)
    WHERE b.is_default = true
      AND b.record_end_date IS NULL
      AND bft.record_end_date IS NULL
      AND ft.name = ${sourceFeatureTypeName}
    LIMIT 1;
  `);
  const blueprintFeatureTypeId: number = bftResult.rows[0].blueprint_feature_type_id;

  await connection.sql(SQL`
    INSERT INTO blueprint_feature_type_property (
      blueprint_feature_type_id,
      feature_type_property_id,
      required_value,
      allow_multiple,
      create_user
    )
    VALUES (
      ${blueprintFeatureTypeId},
      ${featureTypePropertyId},
      false,
      ${allowMultiple},
      ${systemUserId}
    )
    ON CONFLICT (blueprint_feature_type_id, feature_type_property_id)
    WHERE record_end_date IS NULL
    DO NOTHING;
  `);

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

/**
 * Insert a single link row into `submission_feature_property_feature`, tying a source
 * feature to one referenced feature via a `feature`-typed feature_type_property.
 *
 * The link table has no `value` column — the "value" of a feature-typed property is
 * the set of referenced submission_feature_ids carried by these rows. FK semantics:
 * both `submission_feature_id` (source) and `referenced_submission_feature_id` point
 * at `biohub.submission_feature`, and `feature_type_property_id` must be a property
 * declared on the source feature's type.
 */
export async function insertSubmissionFeaturePropertyFeature(
  connection: IDBConnection,
  sourceSubmissionFeatureId: number,
  featureTypePropertyId: number,
  referencedSubmissionFeatureId: number
): Promise<void> {
  const systemUserId = connection.systemUserId();

  await connection.sql(SQL`
    INSERT INTO submission_feature_property_feature (
      submission_feature_id,
      feature_type_property_id,
      blueprint_feature_type_property_id,
      referenced_submission_feature_id,
      create_user
    )
    SELECT
      ${sourceSubmissionFeatureId},
      ${featureTypePropertyId},
      bftp.blueprint_feature_type_property_id,
      ${referencedSubmissionFeatureId},
      ${systemUserId}
    FROM submission_feature sf
    JOIN submission_upload su ON su.submission_upload_id = sf.submission_upload_id
    JOIN blueprint_feature_type bft
      ON bft.blueprint_id = su.blueprint_id AND bft.record_end_date IS NULL
    JOIN blueprint_feature_type_property bftp
      ON bftp.blueprint_feature_type_id = bft.blueprint_feature_type_id
     AND bftp.feature_type_property_id = ${featureTypePropertyId}
     AND bftp.record_end_date IS NULL
    WHERE sf.submission_feature_id = ${sourceSubmissionFeatureId};
  `);
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

// Indexed-property fixtures shared by the read-path suites (search-repository, property-value-read-paths).
// They write canonical rows straight into the typed property tables against seeded feature types, which is
// enough for read paths that resolve values by storage table and feature_type_property.

/** Resolve the active feature_type_property for a (feature type, property name) pair. */
export async function getFeatureTypePropertyId(
  connection: IDBConnection,
  featureTypeName: string,
  propertyName: string
): Promise<number> {
  const result = await connection.sql(SQL`
    SELECT ftp.feature_type_property_id
    FROM feature_type_property ftp
    JOIN feature_type ft ON ft.feature_type_id = ftp.feature_type_id
    JOIN feature_property fp ON fp.feature_property_id = ftp.feature_property_id
    WHERE ft.name = ${featureTypeName}
      AND fp.name = ${propertyName}
      AND ftp.record_end_date IS NULL
    LIMIT 1;
  `);

  if (!result.rows[0]) {
    throw new Error(`No feature_type_property row for (${featureTypeName}, ${propertyName})`);
  }

  return result.rows[0].feature_type_property_id;
}

/** Resolve the Blueprint assignment for a feature's property via its pinned Blueprint (NOT NULL provenance). */
export async function getBlueprintFeatureTypePropertyId(
  connection: IDBConnection,
  submissionFeatureId: number,
  featureTypePropertyId: number
): Promise<number> {
  const result = await connection.sql(SQL`
    SELECT bftp.blueprint_feature_type_property_id
    FROM submission_feature sf
    JOIN submission_upload su ON su.submission_upload_id = sf.submission_upload_id
    JOIN blueprint_feature_type bft
      ON bft.blueprint_id = su.blueprint_id AND bft.feature_type_id = sf.feature_type_id AND bft.record_end_date IS NULL
    JOIN blueprint_feature_type_property bftp
      ON bftp.blueprint_feature_type_id = bft.blueprint_feature_type_id
     AND bftp.feature_type_property_id = ${featureTypePropertyId}
     AND bftp.record_end_date IS NULL
    WHERE sf.submission_feature_id = ${submissionFeatureId}
    LIMIT 1;
  `);

  if (!result.rows[0]) {
    throw new Error(
      `No blueprint_feature_type_property for feature ${submissionFeatureId}, ftp ${featureTypePropertyId}`
    );
  }

  return result.rows[0].blueprint_feature_type_property_id;
}

/** Index a string value for a feature under a seeded (feature type, property name). */
export async function addStringProperty(
  connection: IDBConnection,
  submissionFeatureId: number,
  featureTypeName: string,
  propertyName: string,
  value: string
): Promise<void> {
  const systemUserId = connection.systemUserId();
  const ftpId = await getFeatureTypePropertyId(connection, featureTypeName, propertyName);
  const bftpId = await getBlueprintFeatureTypePropertyId(connection, submissionFeatureId, ftpId);

  await connection.sql(SQL`
    INSERT INTO submission_feature_property_string (submission_feature_id, feature_type_property_id, blueprint_feature_type_property_id, value, create_user)
    VALUES (${submissionFeatureId}, ${ftpId}, ${bftpId}, ${value}, ${systemUserId});
  `);
}

/** Index a code reference for a feature under a seeded (feature type, property name). */
export async function addCodeProperty(
  connection: IDBConnection,
  submissionFeatureId: number,
  featureTypeName: string,
  propertyName: string,
  contributorCodesetCodeId: number
): Promise<void> {
  const systemUserId = connection.systemUserId();
  const ftpId = await getFeatureTypePropertyId(connection, featureTypeName, propertyName);
  const bftpId = await getBlueprintFeatureTypePropertyId(connection, submissionFeatureId, ftpId);

  await connection.sql(SQL`
    INSERT INTO submission_feature_property_code (submission_feature_id, feature_type_property_id, blueprint_feature_type_property_id, contributor_codeset_code_id, create_user)
    VALUES (${submissionFeatureId}, ${ftpId}, ${bftpId}, ${contributorCodesetCodeId}, ${systemUserId});
  `);
}

/** Index a taxon reference for a feature under a seeded (feature type, property name). */
export async function addTaxonProperty(
  connection: IDBConnection,
  submissionFeatureId: number,
  featureTypeName: string,
  propertyName: string,
  taxonId: number
): Promise<void> {
  const systemUserId = connection.systemUserId();
  const ftpId = await getFeatureTypePropertyId(connection, featureTypeName, propertyName);
  const bftpId = await getBlueprintFeatureTypePropertyId(connection, submissionFeatureId, ftpId);

  await connection.sql(SQL`
    INSERT INTO submission_feature_property_taxon (submission_feature_id, feature_type_property_id, blueprint_feature_type_property_id, taxon_id, create_user)
    VALUES (${submissionFeatureId}, ${ftpId}, ${bftpId}, ${taxonId}, ${systemUserId});
  `);
}

/**
 * Create a contributor codeset (owned by the SIMS contributor) holding one code, and return the code id.
 *
 * The codeset key defaults to a unique synthetic value; pass `codeset` to pin the key/label a test asserts on.
 */
export async function createCodesetCode(
  connection: IDBConnection,
  key: string,
  label: string,
  description: string | null = null,
  codeset: { key?: string; label?: string } = {}
): Promise<number> {
  const systemUserId = connection.systemUserId();
  const codesetKey = codeset.key ?? `int_test_codeset_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  const codesetLabel = codeset.label ?? `Codeset for ${key}`;

  // Mirror createTestSubmission: ensure the SIMS contributor exists before referencing it.
  await connection.sql(SQL`
    INSERT INTO contributor (client_id, description)
    SELECT 'SIMS', 'Integration test contributor'
    WHERE NOT EXISTS (
      SELECT 1 FROM contributor WHERE client_id = 'SIMS' AND record_end_date IS NULL
    );
  `);

  const codesetResult = await connection.sql(SQL`
    INSERT INTO contributor_codeset (contributor_id, key, label, create_user)
    VALUES (
      (SELECT contributor_id FROM contributor WHERE client_id = 'SIMS' AND record_end_date IS NULL LIMIT 1),
      ${codesetKey},
      ${codesetLabel},
      ${systemUserId}
    )
    RETURNING contributor_codeset_id;
  `);
  const codesetId = codesetResult.rows[0].contributor_codeset_id;

  const codeResult = await connection.sql(SQL`
    INSERT INTO contributor_codeset_code (contributor_codeset_id, key, label, description, create_user)
    VALUES (${codesetId}, ${key}, ${label}, ${description}, ${systemUserId})
    RETURNING contributor_codeset_code_id;
  `);

  return codeResult.rows[0].contributor_codeset_code_id;
}

// Auto-assigned `itis_tsn` for taxa where the test doesn't care about the TSN value.
// taxon.itis_tsn is NOT NULL UNIQUE, so each row needs a fresh integer.
let nextSyntheticTsn = 100_000_000;

/** Create a taxon row and return its id. `rank` is the ITIS rank string (e.g. 'Species'). */
export async function createTaxon(
  connection: IDBConnection,
  scientificName: string,
  commonName: string | null = null,
  tsn: number | null = null,
  bcCode: string | null = null,
  rank: string | null = null
): Promise<number> {
  const systemUserId = connection.systemUserId();
  const effectiveTsn = tsn ?? nextSyntheticTsn++;

  const result = await connection.sql(SQL`
    INSERT INTO taxon (itis_scientific_name, common_name, itis_tsn, bc_taxon_code, rank, itis_data, itis_update_date, create_user)
    VALUES (${scientificName}, ${commonName}, ${effectiveTsn}, ${bcCode}, ${rank}, '{}'::jsonb, now(), ${systemUserId})
    RETURNING taxon_id;
  `);
  return result.rows[0].taxon_id;
}
