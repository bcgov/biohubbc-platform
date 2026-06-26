// Integration test for the Parquet download pipeline — verifies the typed-table
// cursor + hydration path that reads from submission_feature_property_* tables
// and resolves code labels, taxon names, geometry GeoJSON, and JSONB fallback.
//
// Tests the search-query cursor + hydration helper that powers
// `DownloadPipelineService.writeFeatureTypeParquet`:
//   streamFeatureBaseBySearchQueryAndType  →  fetchTypedPropertyRows
//
// Also covers: status transitions and the writeFeatureTypeParquet artifact contract
// (one artifact + one download_version_artifact row per feature type, idempotent on retry).
//
// Uses a transaction that is ROLLED BACK after each test, so no data is persisted.
//
// Run: make test-db
// Requires: make web (database must be running with seed data)

import * as parquetjs from '@dsnp/parquetjs';
import { expect } from 'chai';
import { randomInt, randomUUID } from 'node:crypto';
import sinon from 'sinon';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { ApiConflictError } from '../../errors/api-error';
import { DATETIME_DATE_SUFFIX, DATETIME_TIME_SUFFIX } from '../../models/datetime-column';
import { ParquetFeatureData } from '../../models/download';
import { DownloadStatusEnum } from '../../models/download-status';
import { ActivePolicyStatementWithExpression } from '../../repositories/authorization/policy-statement-repository';
import { SecurityScopeRepository } from '../../repositories/authorization/security-scope-repository';
import { BaseFeatureRow, DownloadRepository } from '../../repositories/download/download-repository';
import { DownloadVersionRepository } from '../../repositories/download/download-version-repository';
import { buildBroadFeatureTypeSubquery } from '../../repositories/expression-evaluation';
import { DownloadPipelineService } from '../../services/download/download-pipeline-service';
import { DownloadPolicyService } from '../../services/download/download-policy-service';
import { DownloadService } from '../../services/download/download-service';
import { ObjectStorageService } from '../../services/object-storage/object-storage-service';
import { SubmissionFeatureClosureService } from '../../services/submission-feature-closure-service';
import { CsvPropertyDefinition } from '../../utils/csv-utils';
import {
  createFeatureTypeProperty,
  createTestUpload,
  insertSubmissionFeaturePropertyFeature
} from '../helpers/test-feature-property-helpers';
import { secureFeature, setupFullAccess } from '../helpers/test-rbac-helpers';
import { createTestFeature, createTestSubmission } from '../helpers/test-submission-helpers';

/**
 * Helper: assemble ParquetFeatureData from base rows + typed property rows.
 * Mirrors the service-layer hydrateFeatureBatch logic for integration testing.
 * Pure function — extracted to module scope so it is not re-created per test.
 */
function assembleFeatureData(
  baseBatch: {
    submission_feature_id: number;
    uuid: string;
    feature_type_name: string;
    data: Record<string, any>;
    parent_uuid: string | null;
  }[],
  typedRows: { submission_feature_id: number; name: string; value: any }[],
  properties: CsvPropertyDefinition[]
): ParquetFeatureData[] {
  const JSONB_FALLBACK_TYPES = new Set(['array', 'object', 'artifact_key']);

  const propertyMap = new Map<number, Record<string, any>>();
  for (const row of typedRows) {
    if (!propertyMap.has(row.submission_feature_id)) {
      propertyMap.set(row.submission_feature_id, {});
    }
    propertyMap.get(row.submission_feature_id)![row.name] = row.value;
  }

  return baseBatch.map((baseRow) => {
    const typedProps = propertyMap.get(baseRow.submission_feature_id) ?? {};
    const data: Record<string, any> = {};

    for (const prop of properties) {
      const propName = prop.feature_property_name;
      if (JSONB_FALLBACK_TYPES.has(prop.feature_property_type_name)) {
        data[propName] = baseRow.data?.properties?.[propName] ?? null;
      } else if (prop.feature_property_type_name === 'datetime') {
        // Mirror production hydrator: datetime properties are projected as two
        // synthetic rows (`<prop>_date`, `<prop>_time`); write both keys.
        const dateKey = `${propName}${DATETIME_DATE_SUFFIX}`;
        const timeKey = `${propName}${DATETIME_TIME_SUFFIX}`;
        data[dateKey] = typedProps[dateKey] ?? null;
        data[timeKey] = typedProps[timeKey] ?? null;
      } else if (propName in typedProps) {
        data[propName] = typedProps[propName];
      } else {
        data[propName] = null;
      }
    }

    return {
      submission_feature_id: baseRow.submission_feature_id,
      uuid: baseRow.uuid,
      feature_type_name: baseRow.feature_type_name,
      data,
      parent_uuid: baseRow.parent_uuid
    };
  });
}

/**
 * Helper: stub @dsnp/parquetjs ParquetWriter.openStream and ObjectStorageService.uploadStream.
 *
 * The Parquet writer is replaced with a no-op that never writes to the stream,
 * so the PassThrough receives zero bytes (hash = SHA-256 of empty input, byteCount = 0).
 * The upload is stubbed to resolve without consuming the stream. The real SQL paths
 * for ArtifactService.insertArtifact and DownloadVersionRepository.createDownloadVersionArtifact
 * remain unstubbed — those are exactly the idempotency contracts we verify.
 */
function stubParquetAndUpload(): { uploadStub: sinon.SinonStub } {
  const mockWriter = { appendRow: sinon.stub().resolves(), close: sinon.stub().resolves() };
  sinon.stub(parquetjs.ParquetWriter, 'openStream').resolves(mockWriter as any);
  const uploadStub = sinon.stub(ObjectStorageService.prototype, 'uploadStream').resolves();
  return { uploadStub };
}

describe('Download Parquet pipeline (integration)', function () {
  this.timeout(15000);

  let connection: IDBConnection;
  let downloadRepo: DownloadRepository;
  let downloadVersionRepo: DownloadVersionRepository;
  let pipelineService: DownloadPipelineService;
  let downloadService: DownloadService;
  let policyService: DownloadPolicyService;
  let scopeRepo: SecurityScopeRepository;

  before(() => {
    initDBPool(defaultPoolConfig);
  });

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    downloadRepo = new DownloadRepository(connection);
    downloadVersionRepo = new DownloadVersionRepository(connection);
    pipelineService = new DownloadPipelineService(connection);
    downloadService = new DownloadService(connection);
    policyService = new DownloadPolicyService(connection);
    scopeRepo = new SecurityScopeRepository(connection);
  });

  afterEach(async () => {
    sinon.restore();
    await connection.rollback();
    connection.release();
  });

  // ── Helpers ──────────────────────────────────────────────────────────

  /**
   * Helper: create a download policy + download row in one shot, returning the
   * download id. The returned download is the standard broad-path policy used
   * by the writeFeatureTypeParquet tests below.
   */
  async function createPolicyDownload(featureTypes: string[]): Promise<string> {
    const { policy_id } = await policyService.createDownloadPolicy({
      name: `pq-pipeline-test-${Date.now()}-${randomUUID().slice(0, 8)}`,
      description: null,
      featureTypes,
      expressionId: null
    });
    const { download_id } = await downloadService.createDownload({
      policyId: policy_id,
      format: 'parquet',
      requestedBy: connection.systemUserId()
    });
    return download_id;
  }

  /**
   * Helper: materialize a download_version for the given download, returning the
   * version id. The Parquet pipeline links each produced artifact to this version
   * via download_version_artifact, so the writeFeatureTypeParquet tests below need
   * a real version row (FK target). Reads resolve the most-recent active version —
   * there is no stored current-version pointer to set.
   */
  async function createDownloadVersionFor(downloadId: string): Promise<string> {
    const version = await downloadVersionRepo.createDownloadVersion(downloadId);
    return version.download_version_id;
  }

  /**
   * Insert ONE submission_feature bound to a SPECIFIC upload, resolving feature_type_id by name.
   *
   * The export security filter resolves "is this feature secured" via the precomputed closure
   * (isEffectivelySecured), which needs the feature's closure SELF-LOOP. That self-loop only
   * exists after computeClosureForUpload runs for the feature's upload. createTestFeature mints a NEW
   * upload per call and never rebuilds the closure, so a feature secured that way reads as unsecured and
   * is NOT stripped. The security tests therefore seed features directly under a SHARED upload via
   * createTestUpload + this helper, then rebuild the closure AFTER securing and BEFORE the subquery.
   *
   * @returns The new submission_feature_id.
   */
  async function insertFeatureRow(params: {
    submissionId: number;
    submissionUploadId: string;
    featureTypeName: string;
    parentFeatureId?: number;
  }): Promise<number> {
    const systemUserId = connection.systemUserId();

    const result = await connection.sql(SQL`
      INSERT INTO submission_feature (
        submission_id,
        submission_upload_id,
        feature_type_id,
        parent_submission_feature_id,
        data,
        data_byte_size,
        record_effective_date,
        create_user
      )
      VALUES (
        ${params.submissionId},
        ${params.submissionUploadId}::uuid,
        (SELECT feature_type_id FROM feature_type WHERE name = ${params.featureTypeName} LIMIT 1),
        ${params.parentFeatureId ?? null},
        '{}'::jsonb,
        500,
        now(),
        ${systemUserId}
      )
      RETURNING submission_feature_id;
    `);

    return result.rows[0].submission_feature_id;
  }

  /**
   * Helper: insert a typed property row into the appropriate submission_feature_property_* table.
   *
   * For string/number/boolean/timestamp/geometry: inserts (submission_feature_id, feature_type_property_id, value, create_user).
   * For code: value is the contributor_codeset_code_id.
   * For taxon: value is the taxon_id.
   * For geometry: value is a GeoJSON string passed through ST_GeomFromGeoJSON.
   */
  async function insertTypedPropertyRow(
    tableName: string,
    submissionFeatureId: number,
    featureTypePropertyId: number,
    value: unknown
  ): Promise<void> {
    const systemUserId = connection.systemUserId();

    if (tableName === 'submission_feature_property_code') {
      await connection.sql(SQL`
        INSERT INTO submission_feature_property_code (submission_feature_id, feature_type_property_id, contributor_codeset_code_id, create_user)
        VALUES (${submissionFeatureId}, ${featureTypePropertyId}, ${value as number}, ${systemUserId});
      `);
    } else if (tableName === 'submission_feature_property_taxon') {
      await connection.sql(SQL`
        INSERT INTO submission_feature_property_taxon (submission_feature_id, feature_type_property_id, taxon_id, create_user)
        VALUES (${submissionFeatureId}, ${featureTypePropertyId}, ${value as number}, ${systemUserId});
      `);
    } else if (tableName === 'submission_feature_property_geometry') {
      await connection.query(
        `INSERT INTO submission_feature_property_geometry (submission_feature_id, feature_type_property_id, value, create_user)
         VALUES ($1, $2, ST_GeomFromGeoJSON($3), $4)`,
        [submissionFeatureId, featureTypePropertyId, value as string, systemUserId]
      );
    } else if (tableName === 'submission_feature_property_timestamp') {
      const ts = value as { date_value: string | null; time_value: string | null };
      await connection.query(
        `INSERT INTO submission_feature_property_timestamp
           (submission_feature_id, feature_type_property_id, date_value, time_value, create_user)
         VALUES ($1, $2, $3, $4, $5)`,
        [submissionFeatureId, featureTypePropertyId, ts.date_value, ts.time_value, systemUserId]
      );
    } else {
      // string, number, boolean — all use a `value` column
      await connection.query(
        `INSERT INTO ${tableName} (submission_feature_id, feature_type_property_id, value, create_user)
         VALUES ($1, $2, $3, $4)`,
        [submissionFeatureId, featureTypePropertyId, value, systemUserId]
      );
    }
  }

  /**
   * Helper: insert a code-type feature property and return the IDs needed for typed row insertion.
   *
   * Inserts: feature_property_type 'code' (if absent), feature_property, feature_type_property,
   * contributor_codeset, and contributor_codeset_code. Mirrors the SIMS tarball submission flow.
   *
   * @param featureTypeName - The feature type to attach the property to (e.g. 'capture').
   * @param propertyName - The feature property name (e.g. 'sex_code') — the Parquet column header.
   * @param contributorCodesetKey - Codeset key (e.g. 'sex') — maps to `contributor_codeset.key`.
   * @param contributorCodesetCodeKey - Code key within the codeset (e.g. 'male') — maps to `contributor_codeset_code.key`.
   * @param codeLabel - The human-readable label (e.g. 'male') — what the Parquet pipeline outputs.
   * @returns { featureTypePropertyId, contributorCodesetCodeId }
   */
  async function insertCodeFeatureProperty(
    featureTypeName: string,
    propertyName: string,
    contributorCodesetKey: string,
    contributorCodesetCodeKey: string,
    codeLabel: string
  ): Promise<{ featureTypePropertyId: number; contributorCodesetCodeId: number }> {
    const systemUserId = connection.systemUserId();

    await connection.sql(SQL`
      INSERT INTO feature_property_type (name, record_effective_date, create_user)
      SELECT 'code', now(), ${systemUserId}
      WHERE NOT EXISTS (SELECT 1 FROM feature_property_type WHERE name = 'code');
    `);

    const codeTypeResult = await connection.sql(SQL`
      SELECT feature_property_type_id FROM feature_property_type WHERE name = 'code';
    `);
    const codeTypeId = codeTypeResult.rows[0].feature_property_type_id;

    const fpResult = await connection.sql(SQL`
      INSERT INTO feature_property (feature_property_type_id, name, display_name, record_effective_date, create_user)
      VALUES (${codeTypeId}, ${propertyName}, ${propertyName}, now(), ${systemUserId})
      RETURNING feature_property_id;
    `);
    const featurePropertyId = fpResult.rows[0].feature_property_id;

    const ftpResult = await connection.sql(SQL`
      INSERT INTO feature_type_property (feature_type_id, feature_property_id, record_effective_date, create_user)
      VALUES (
        (SELECT feature_type_id FROM feature_type WHERE name = ${featureTypeName} LIMIT 1),
        ${featurePropertyId},
        now(),
        ${systemUserId}
      )
      RETURNING feature_type_property_id;
    `);
    const featureTypePropertyId = ftpResult.rows[0].feature_type_property_id;

    const codesetResult = await connection.sql(SQL`
      INSERT INTO contributor_codeset (contributor_id, key, label, create_user)
      VALUES (
        (SELECT contributor_id FROM contributor WHERE client_id = 'SIMS' AND record_end_date IS NULL LIMIT 1),
        ${contributorCodesetKey},
        ${contributorCodesetKey},
        ${systemUserId}
      )
      RETURNING contributor_codeset_id;
    `);
    const codesetId = codesetResult.rows[0].contributor_codeset_id;

    const codeResult = await connection.sql(SQL`
      INSERT INTO contributor_codeset_code (contributor_codeset_id, key, label, create_user)
      VALUES (${codesetId}, ${contributorCodesetCodeKey}, ${codeLabel}, ${systemUserId})
      RETURNING contributor_codeset_code_id;
    `);
    const contributorCodesetCodeId = codeResult.rows[0].contributor_codeset_code_id;

    return { featureTypePropertyId, contributorCodesetCodeId };
  }

  /**
   * Helper: insert a taxon-type feature property and return the IDs needed for typed row insertion.
   */
  async function insertTaxonFeatureProperty(
    featureTypeName: string,
    propertyName: string,
    scientificName: string
  ): Promise<{ featureTypePropertyId: number; taxonId: number }> {
    const systemUserId = connection.systemUserId();

    const taxonTypeResult = await connection.sql(SQL`
      SELECT feature_property_type_id FROM feature_property_type WHERE name = 'taxon';
    `);
    const taxonTypeId = taxonTypeResult.rows[0].feature_property_type_id;

    const fpResult = await connection.sql(SQL`
      INSERT INTO feature_property (feature_property_type_id, name, display_name, record_effective_date, create_user)
      VALUES (${taxonTypeId}, ${propertyName}, ${propertyName}, now(), ${systemUserId})
      RETURNING feature_property_id;
    `);
    const featurePropertyId = fpResult.rows[0].feature_property_id;

    const ftpResult = await connection.sql(SQL`
      INSERT INTO feature_type_property (feature_type_id, feature_property_id, record_effective_date, create_user)
      VALUES (
        (SELECT feature_type_id FROM feature_type WHERE name = ${featureTypeName} LIMIT 1),
        ${featurePropertyId},
        now(),
        ${systemUserId}
      )
      RETURNING feature_type_property_id;
    `);
    const featureTypePropertyId = ftpResult.rows[0].feature_type_property_id;

    const tsn = randomInt(100000, 1000000);
    const uniqueName = `${scientificName} [test-${tsn}]`;
    const taxonResult = await connection.sql(SQL`
      INSERT INTO taxon (itis_tsn, itis_scientific_name, itis_data, itis_update_date, record_effective_date, create_user)
      VALUES (${tsn}, ${uniqueName}, '{}'::jsonb, now(), now(), ${systemUserId})
      RETURNING taxon_id;
    `);
    const taxonId = taxonResult.rows[0].taxon_id;

    return { featureTypePropertyId, taxonId };
  }

  /**
   * Helper: stream base feature rows via the search-query path (filtered by
   * submission_id), then hydrate with typed property values.
   *
   * The legacy cursor is gone — every download flow now resolves features through
   * an expression-evaluator subquery. For these tests we substitute a simple
   * "all features for this submission" subquery so each test's fixture set is
   * the unit under hydration; the typed-table joins are what we actually verify.
   */
  async function streamAndHydrateBySubmission(
    submissionId: number,
    featureTypeName: string,
    properties: CsvPropertyDefinition[],
    cursorScopeId: string
  ): Promise<ParquetFeatureData[]> {
    const searchSql = 'SELECT submission_feature_id FROM submission_feature WHERE submission_id = $1';
    return hydrateFromStream(
      downloadRepo.streamFeatureBaseBySearchQueryAndType(
        cursorScopeId,
        searchSql,
        [submissionId],
        featureTypeName,
        100
      ),
      properties
    );
  }

  /**
   * Helper: consume a base-feature-row stream and hydrate each batch with typed property values.
   * Collects the result into a flat array — fine for test-sized data sets.
   */
  async function hydrateFromStream(
    stream: AsyncGenerator<BaseFeatureRow[]>,
    properties: CsvPropertyDefinition[]
  ): Promise<ParquetFeatureData[]> {
    const JSONB_FALLBACK_TYPES = new Set(['array', 'object', 'artifact_key']);
    const typedPropertyTypes = [
      ...new Set(properties.map((p) => p.feature_property_type_name).filter((t) => !JSONB_FALLBACK_TYPES.has(t)))
    ];
    const allRows: ParquetFeatureData[] = [];

    for await (const baseBatch of stream) {
      const ids = baseBatch.map((r) => r.submission_feature_id);
      const typedRows =
        typedPropertyTypes.length > 0 ? await downloadRepo.fetchTypedPropertyRows(ids, typedPropertyTypes) : [];
      allRows.push(...assembleFeatureData(baseBatch, typedRows, properties));
    }

    return allRows;
  }

  // ── Tests ────────────────────────────────────────────────────────────

  describe('cursor + hydration', () => {
    it('hydrates string and number properties from typed tables', async () => {
      const submissionId = await createTestSubmission(connection);

      // capture.comment → ftp_id=62 (string)
      const captureFeatureId = await createTestFeature(connection, submissionId, 'capture', {
        comment: 'test capture'
      });

      await insertTypedPropertyRow('submission_feature_property_string', captureFeatureId, 62, 'Test comment value');
      await insertTypedPropertyRow('submission_feature_property_timestamp', captureFeatureId, 51, {
        date_value: '2024-06-15',
        time_value: '10:30:00'
      });

      const captureProperties: CsvPropertyDefinition[] = [
        { feature_property_name: 'comment', feature_property_type_name: 'string' },
        { feature_property_name: 'timestamp', feature_property_type_name: 'datetime' }
      ];

      const captureRows = await streamAndHydrateBySubmission(
        submissionId,
        'capture',
        captureProperties,
        'pq-cursor-string'
      );
      expect(captureRows).to.have.length(1);
      expect(captureRows[0].data.comment).to.equal('Test comment value');
      expect(captureRows[0].data.timestamp_date).to.equal('2024-06-15');
      expect(captureRows[0].data.timestamp_time).to.equal('10:30:00');

      // measurement.measurement_value → ftp_id=29 (number)
      const submissionMeasurement = await createTestSubmission(connection);
      const measurementFeatureId = await createTestFeature(connection, submissionMeasurement, 'measurement', {
        measurement_value: 42.5
      });
      await insertTypedPropertyRow('submission_feature_property_number', measurementFeatureId, 29, 42.5);

      const measurementProperties: CsvPropertyDefinition[] = [
        { feature_property_name: 'measurement_value', feature_property_type_name: 'number' }
      ];

      const measurementRows = await streamAndHydrateBySubmission(
        submissionMeasurement,
        'measurement',
        measurementProperties,
        'pq-cursor-num'
      );
      expect(measurementRows).to.have.length(1);
      expect(Number(measurementRows[0].data.measurement_value)).to.equal(42.5);
    });

    it('hydrates a date-only timestamp into <prop>_date with <prop>_time null', async () => {
      const submissionId = await createTestSubmission(connection);
      const captureFeatureId = await createTestFeature(connection, submissionId, 'capture', { comment: 'date-only' });
      await insertTypedPropertyRow('submission_feature_property_timestamp', captureFeatureId, 51, {
        date_value: '2024-06-15',
        time_value: null
      });

      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'timestamp', feature_property_type_name: 'datetime' }
      ];
      const rows = await streamAndHydrateBySubmission(submissionId, 'capture', properties, 'pq-cursor-date-only');

      expect(rows).to.have.length(1);
      expect(rows[0].data.timestamp_date).to.equal('2024-06-15');
      // timestamp_time may be null (set by hydrator) or undefined (key never written) — accept both
      expect(rows[0].data.timestamp_time ?? null).to.be.null;
      expect(captureFeatureId).to.be.a('number');
    });

    it('hydrates a time-only timestamp into <prop>_time with <prop>_date null', async () => {
      const submissionId = await createTestSubmission(connection);
      const captureFeatureId = await createTestFeature(connection, submissionId, 'capture', { comment: 'time-only' });
      await insertTypedPropertyRow('submission_feature_property_timestamp', captureFeatureId, 51, {
        date_value: null,
        time_value: '10:30:00'
      });

      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'timestamp', feature_property_type_name: 'datetime' }
      ];
      const rows = await streamAndHydrateBySubmission(submissionId, 'capture', properties, 'pq-cursor-time-only');

      expect(rows).to.have.length(1);
      expect(rows[0].data.timestamp_date ?? null).to.be.null;
      expect(rows[0].data.timestamp_time).to.equal('10:30:00');
      expect(captureFeatureId).to.be.a('number');
    });

    it('resolves code property to contributor_codeset_code.label', async () => {
      const submissionId = await createTestSubmission(connection);
      const captureFeatureId = await createTestFeature(connection, submissionId, 'capture', {
        sex_code: 'code::sex::male'
      });

      const { featureTypePropertyId, contributorCodesetCodeId } = await insertCodeFeatureProperty(
        'capture',
        'sex_code',
        'sex',
        'male',
        'male'
      );

      await insertTypedPropertyRow(
        'submission_feature_property_code',
        captureFeatureId,
        featureTypePropertyId,
        contributorCodesetCodeId
      );

      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'sex_code', feature_property_type_name: 'code' }
      ];

      const rows = await streamAndHydrateBySubmission(submissionId, 'capture', properties, 'pq-code');
      expect(rows).to.have.length(1);
      expect(rows[0].data.sex_code).to.equal('male');
    });

    it('resolves taxon property to taxon.itis_scientific_name', async () => {
      const submissionId = await createTestSubmission(connection);
      const captureFeatureId = await createTestFeature(connection, submissionId, 'capture', {
        species: 'Ursus arctos'
      });

      const { featureTypePropertyId, taxonId } = await insertTaxonFeatureProperty('capture', 'species', 'Ursus arctos');

      await insertTypedPropertyRow(
        'submission_feature_property_taxon',
        captureFeatureId,
        featureTypePropertyId,
        taxonId
      );

      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'species', feature_property_type_name: 'taxon' }
      ];

      const rows = await streamAndHydrateBySubmission(submissionId, 'capture', properties, 'pq-taxon');
      expect(rows).to.have.length(1);
      expect(rows[0].data.species).to.be.a('string');
      expect(rows[0].data.species).to.include('Ursus arctos');
    });

    describe('feature properties', () => {
      it('hydrates a single feature reference into a length-1 URN array', async () => {
        const submissionId = await createTestSubmission(connection);
        const sourceFeatureId = await createTestFeature(connection, submissionId, 'capture', { comment: 'src' });
        const referencedFeatureId = await createTestFeature(connection, submissionId, 'observation_subcount', {
          name: 'ref-1'
        });

        const { featureTypePropertyId, propertyName } = await createFeatureTypeProperty(
          connection,
          'capture',
          'observation_subcount',
          true
        );

        await insertSubmissionFeaturePropertyFeature(
          connection,
          sourceFeatureId,
          featureTypePropertyId,
          referencedFeatureId
        );

        const refRow = await connection.sql(SQL`
          SELECT urn FROM submission_feature WHERE submission_feature_id = ${referencedFeatureId};
        `);
        const urnR1 = refRow.rows[0].urn;

        const properties: CsvPropertyDefinition[] = [
          { feature_property_name: propertyName, feature_property_type_name: 'feature' }
        ];

        const rows = await streamAndHydrateBySubmission(submissionId, 'capture', properties, 'pq-feature-single');
        const sourceRow = rows.find((r) => r.submission_feature_id === sourceFeatureId);
        expect(sourceRow).to.exist;
        expect(sourceRow!.data[propertyName]).to.deep.equal([urnR1]);
      });

      it('orders multiple feature references ASC by referenced_submission_feature_id', async () => {
        const submissionId = await createTestSubmission(connection);
        const sourceFeatureId = await createTestFeature(connection, submissionId, 'capture', { comment: 'src' });
        const referencedFeatureId1 = await createTestFeature(connection, submissionId, 'observation_subcount', {
          name: 'ref-1'
        });
        const referencedFeatureId2 = await createTestFeature(connection, submissionId, 'observation_subcount', {
          name: 'ref-2'
        });
        // Sanity: ids are inserted in ascending order
        expect(referencedFeatureId1).to.be.lessThan(referencedFeatureId2);

        const { featureTypePropertyId, propertyName } = await createFeatureTypeProperty(
          connection,
          'capture',
          'observation_subcount',
          true
        );

        // Insert link rows in REVERSE order to prove the SQL's ORDER BY does the work
        await insertSubmissionFeaturePropertyFeature(
          connection,
          sourceFeatureId,
          featureTypePropertyId,
          referencedFeatureId2
        );
        await insertSubmissionFeaturePropertyFeature(
          connection,
          sourceFeatureId,
          featureTypePropertyId,
          referencedFeatureId1
        );

        const refRows = await connection.sql(SQL`
          SELECT submission_feature_id, urn FROM submission_feature
          WHERE submission_feature_id = ANY(${[referencedFeatureId1, referencedFeatureId2]})
          ORDER BY submission_feature_id ASC;
        `);
        const urnR1 = refRows.rows[0].urn;
        const urnR2 = refRows.rows[1].urn;

        const properties: CsvPropertyDefinition[] = [
          { feature_property_name: propertyName, feature_property_type_name: 'feature' }
        ];

        const rows = await streamAndHydrateBySubmission(submissionId, 'capture', properties, 'pq-feature-multi');
        const sourceRow = rows.find((r) => r.submission_feature_id === sourceFeatureId);
        expect(sourceRow).to.exist;
        expect(sourceRow!.data[propertyName]).to.deep.equal([urnR1, urnR2]);
      });

      it('returns null when a feature property is requested but no link rows exist', async () => {
        const submissionId = await createTestSubmission(connection);
        const sourceFeatureId = await createTestFeature(connection, submissionId, 'capture', { comment: 'src' });

        const { propertyName } = await createFeatureTypeProperty(connection, 'capture', 'observation_subcount', true);

        const properties: CsvPropertyDefinition[] = [
          { feature_property_name: propertyName, feature_property_type_name: 'feature' }
        ];

        const rows = await streamAndHydrateBySubmission(submissionId, 'capture', properties, 'pq-feature-none');
        const sourceRow = rows.find((r) => r.submission_feature_id === sourceFeatureId);
        expect(sourceRow).to.exist;
        expect(sourceRow!.data[propertyName]).to.be.null;
      });

      it('excludes soft-deleted referenced features from the URN array', async () => {
        const submissionId = await createTestSubmission(connection);
        const sourceFeatureId = await createTestFeature(connection, submissionId, 'capture', { comment: 'src' });
        const referencedFeatureLiveId = await createTestFeature(connection, submissionId, 'observation_subcount', {
          name: 'live'
        });
        const referencedFeatureDeletedId = await createTestFeature(connection, submissionId, 'observation_subcount', {
          name: 'soft-deleted'
        });

        const { featureTypePropertyId, propertyName } = await createFeatureTypeProperty(
          connection,
          'capture',
          'observation_subcount',
          true
        );

        await insertSubmissionFeaturePropertyFeature(
          connection,
          sourceFeatureId,
          featureTypePropertyId,
          referencedFeatureLiveId
        );
        await insertSubmissionFeaturePropertyFeature(
          connection,
          sourceFeatureId,
          featureTypePropertyId,
          referencedFeatureDeletedId
        );

        // Soft-delete one referenced feature
        await connection.sql(SQL`
          UPDATE submission_feature
          SET record_end_date = now()
          WHERE submission_feature_id = ${referencedFeatureDeletedId};
        `);

        const liveRow = await connection.sql(SQL`
          SELECT urn FROM submission_feature WHERE submission_feature_id = ${referencedFeatureLiveId};
        `);
        const urnLive = liveRow.rows[0].urn;

        const properties: CsvPropertyDefinition[] = [
          { feature_property_name: propertyName, feature_property_type_name: 'feature' }
        ];

        const rows = await streamAndHydrateBySubmission(submissionId, 'capture', properties, 'pq-feature-soft-deleted');
        const sourceRow = rows.find((r) => r.submission_feature_id === sourceFeatureId);
        expect(sourceRow).to.exist;
        expect(sourceRow!.data[propertyName]).to.deep.equal([urnLive]);
      });
    });

    it('returns geometry as GeoJSON object', async () => {
      const submissionId = await createTestSubmission(connection);
      const sampleSiteFeatureId = await createTestFeature(connection, submissionId, 'sample_site', {
        name: 'Geo Site'
      });

      const geoJson = JSON.stringify({
        type: 'Point',
        coordinates: [-123.3656, 48.4284]
      });

      await insertTypedPropertyRow('submission_feature_property_geometry', sampleSiteFeatureId, 4, geoJson);

      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'geometry', feature_property_type_name: 'spatial' }
      ];

      const rows = await streamAndHydrateBySubmission(submissionId, 'sample_site', properties, 'pq-geo');
      expect(rows).to.have.length(1);

      const geom = rows[0].data.geometry;
      expect(geom).to.not.be.null;
      expect(geom.type).to.equal('Point');
      expect(geom.coordinates).to.be.an('array');
      expect(geom.coordinates).to.have.length(2);
    });

    it('populates parent_uuid for child features', async () => {
      const submissionId = await createTestSubmission(connection);
      const parentFeatureId = await createTestFeature(connection, submissionId, 'survey', { name: 'Parent DS' });
      // Returned id intentionally discarded — the test asserts on the parent_uuid
      // field of the hydrated capture row, not on its own id.
      await createTestFeature(connection, submissionId, 'capture', { comment: 'child' }, parentFeatureId);

      const parentRow = await connection.sql(SQL`
        SELECT uuid FROM submission_feature WHERE submission_feature_id = ${parentFeatureId};
      `);
      const parentUuid = parentRow.rows[0].uuid;

      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'comment', feature_property_type_name: 'string' }
      ];

      const rows = await streamAndHydrateBySubmission(submissionId, 'capture', properties, 'pq-parent-uuid');
      expect(rows).to.have.length(1);
      expect(rows[0].parent_uuid).to.equal(parentUuid);
    });

    it('returns null for properties missing from typed tables', async () => {
      const submissionId = await createTestSubmission(connection);
      const captureFeatureId = await createTestFeature(connection, submissionId, 'capture', { comment: 'partial' });

      // Only insert a string typed row for 'comment' — no boolean row.
      // Mixing types in the requested-properties list exercises the
      // "missing typed row → null" branch without leaning on datetime
      // (whose hydration query is broken upstream — see follow-up JIRA).
      await insertTypedPropertyRow('submission_feature_property_string', captureFeatureId, 62, 'Partial data');

      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'comment', feature_property_type_name: 'string' },
        // Use a boolean property name with no matching row — picks the boolean
        // typed-table query, which has no rows to return.
        { feature_property_name: 'imaginary_bool', feature_property_type_name: 'boolean' }
      ];

      const rows = await streamAndHydrateBySubmission(submissionId, 'capture', properties, 'pq-missing');
      expect(rows).to.have.length(1);
      expect(rows[0].data.comment).to.equal('Partial data');
      expect(rows[0].data.imaginary_bool).to.be.null;
    });

    it('falls back to JSONB for array properties', async () => {
      const submissionId = await createTestSubmission(connection);
      const surveyFeatureId = await createTestFeature(connection, submissionId, 'survey', {
        name: 'Array Test',
        properties: { focal_species: ['bear', 'elk'] }
      });

      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'focal_species', feature_property_type_name: 'array' }
      ];

      const rows = await streamAndHydrateBySubmission(submissionId, 'survey', properties, 'pq-array');
      expect(rows).to.have.length(1);
      expect(rows[0].data.focal_species).to.deep.equal(['bear', 'elk']);
      // Suppress unused-variable warning — the feature id keeps the helper output traceable in failures.
      expect(surveyFeatureId).to.be.a('number');
    });

    it('hydrates multiple features in same batch without cross-contamination', async () => {
      const submissionId = await createTestSubmission(connection);

      // Two capture features with different string values for the same property
      const feature1 = await createTestFeature(connection, submissionId, 'capture', { comment: 'first' });
      const feature2 = await createTestFeature(connection, submissionId, 'capture', { comment: 'second' });

      await insertTypedPropertyRow('submission_feature_property_string', feature1, 62, 'Alpha');
      await insertTypedPropertyRow('submission_feature_property_string', feature2, 62, 'Beta');

      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'comment', feature_property_type_name: 'string' }
      ];

      const rows = await streamAndHydrateBySubmission(submissionId, 'capture', properties, 'pq-multi');
      expect(rows).to.have.length(2);

      // Verify properties are assigned to the correct feature (not swapped)
      rows.sort((a, b) => a.submission_feature_id - b.submission_feature_id);
      expect(rows[0].data.comment).to.equal('Alpha');
      expect(rows[1].data.comment).to.equal('Beta');
    });
  });

  describe('status transitions', () => {
    it('transitions download status from pending to processing to ready, and rejects an illegal third transition', async () => {
      const downloadId = await createPolicyDownload(['survey']);
      // Status lives on the version, so the download needs one to be findable, and
      // the transition keys off the version id.
      const downloadVersionId = await createDownloadVersionFor(downloadId);

      // Verify initial state
      const initial = await downloadService.findDownloadById(downloadId);
      expect(initial!.download_status).to.equal(DownloadStatusEnum.PENDING);
      expect(initial!.started_at).to.be.null;
      expect(initial!.completed_at).to.be.null;

      // pending → processing: started_at populated, completed_at still null
      await pipelineService.transitionDownloadVersionStatus(downloadVersionId, DownloadStatusEnum.PROCESSING, [
        DownloadStatusEnum.PENDING
      ]);
      const processing = await downloadService.findDownloadById(downloadId);
      expect(processing!.download_status).to.equal(DownloadStatusEnum.PROCESSING);
      expect(processing!.started_at).to.not.be.null;
      expect(processing!.completed_at).to.be.null;

      const firstStartedAt = processing!.started_at;

      // processing → ready: completed_at populated, started_at unchanged
      await pipelineService.transitionDownloadVersionStatus(downloadVersionId, DownloadStatusEnum.READY, [
        DownloadStatusEnum.PROCESSING
      ]);
      const ready = await downloadService.findDownloadById(downloadId);
      expect(ready!.download_status).to.equal(DownloadStatusEnum.READY);
      expect(ready!.started_at).to.equal(firstStartedAt);
      expect(ready!.completed_at).to.not.be.null;

      // Illegal transition: retrying processing → ready on a READY version throws ApiConflictError
      try {
        await pipelineService.transitionDownloadVersionStatus(downloadVersionId, DownloadStatusEnum.READY, [
          DownloadStatusEnum.PROCESSING
        ]);
        expect.fail('Expected ApiConflictError for illegal transition from READY');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiConflictError);
      }
    });
  });

  describe('writeFeatureTypeParquet — artifact + download_version_artifact rows', () => {
    // ParquetWriter is stubbed — no properties are resolved against typed tables, so
    // an empty property list is safe and minimizes test surface area.
    const emptyProperties: CsvPropertyDefinition[] = [];

    /**
     * Build an `ActivePolicyStatementWithExpression` row shape for the broad path —
     * `expression_id: null` makes `writeFeatureTypeParquet` use
     * `buildBroadFeatureTypeSubquery`, which projects every feature of the type.
     * The stub policy_statement_id never lands in the database, so its value is
     * arbitrary as long as the type-checker accepts it.
     */
    const broadStatement = (urn_feature_type: string): ActivePolicyStatementWithExpression => ({
      policy_statement_id: '00000000-0000-0000-0000-000000000001',
      urn_feature_type,
      expression_id: null
    });

    it('inserts one artifact + one download_version_artifact row for a single feature type', async () => {
      stubParquetAndUpload();

      const submissionId = await createTestSubmission(connection);
      await createTestFeature(connection, submissionId, 'survey', { name: 'Happy path survey' });
      const downloadId = await createPolicyDownload(['survey']);
      const downloadVersionId = await createDownloadVersionFor(downloadId);
      const source = await downloadRepo.getDownloadSource(downloadId);

      await pipelineService.writeFeatureTypeParquet({
        downloadId,
        downloadVersionId,
        source,
        properties: emptyProperties,
        featureTypeName: 'survey',
        statement: broadStatement('survey')
      });

      const artifactRows = await connection.sql(SQL`
        SELECT artifact.artifact_id, artifact.bucket, artifact.object_key, artifact.byte_size,
               artifact.checksum_sha256, artifact.artifact_status, artifact.format, artifact.uploaded_at
        FROM artifact
        INNER JOIN download_version_artifact ON download_version_artifact.artifact_id = artifact.artifact_id
        WHERE download_version_artifact.download_version_id = ${downloadVersionId}
          AND download_version_artifact.record_end_date IS NULL;
      `);
      expect(artifactRows.rowCount).to.equal(1);

      const artifact = artifactRows.rows[0];
      expect(artifact.format).to.equal('parquet');
      expect(artifact.artifact_status).to.equal('uploaded');
      expect(artifact.object_key).to.equal(
        `downloads/${downloadId}/versions/${downloadVersionId}/survey/data.parquet`
      );
      expect(artifact.bucket).to.be.a('string').and.have.length.greaterThan(0);
      expect(artifact.checksum_sha256).to.match(/^[0-9a-f]{64}$/);
      expect(Number(artifact.byte_size)).to.be.at.least(0);
      expect(artifact.uploaded_at).to.not.be.null;

      // Explicit FK linkage: download_version_artifact.artifact_id matches artifact.artifact_id,
      // carries the feature type name, and is keyed to the materialized version.
      const linkRows = await connection.sql(SQL`
        SELECT artifact_id, download_version_id, feature_type_name
        FROM download_version_artifact
        WHERE download_version_id = ${downloadVersionId}
          AND record_end_date IS NULL;
      `);
      expect(linkRows.rowCount).to.equal(1);
      expect(linkRows.rows[0].artifact_id).to.equal(artifact.artifact_id);
      expect(linkRows.rows[0].download_version_id).to.equal(downloadVersionId);
      expect(linkRows.rows[0].feature_type_name).to.equal('survey');

      // download status untouched — writeFeatureTypeParquet does not transition status
      const download = await downloadService.findDownloadById(downloadId);
      expect(download!.download_status).to.equal(DownloadStatusEnum.PENDING);
    });

    it('is idempotent on retry — second call does not create a duplicate artifact or download_version_artifact row', async () => {
      stubParquetAndUpload();

      const submissionId = await createTestSubmission(connection);
      await createTestFeature(connection, submissionId, 'survey', { name: 'Retry survey' });
      const downloadId = await createPolicyDownload(['survey']);
      const downloadVersionId = await createDownloadVersionFor(downloadId);
      const source = await downloadRepo.getDownloadSource(downloadId);

      // Call 1
      await pipelineService.writeFeatureTypeParquet({
        downloadId,
        downloadVersionId,
        source,
        properties: emptyProperties,
        featureTypeName: 'survey',
        statement: broadStatement('survey')
      });

      const afterFirst = await connection.sql(SQL`
        SELECT artifact.artifact_id, artifact.checksum_sha256, artifact.byte_size
        FROM artifact
        INNER JOIN download_version_artifact ON download_version_artifact.artifact_id = artifact.artifact_id
        WHERE download_version_artifact.download_version_id = ${downloadVersionId}
          AND download_version_artifact.record_end_date IS NULL;
      `);
      expect(afterFirst.rowCount).to.equal(1);
      const firstArtifactId = afterFirst.rows[0].artifact_id;
      const firstChecksum = afterFirst.rows[0].checksum_sha256;
      const firstByteSize = afterFirst.rows[0].byte_size;

      // Call 2 — same download, same feature type
      await pipelineService.writeFeatureTypeParquet({
        downloadId,
        downloadVersionId,
        source,
        properties: emptyProperties,
        featureTypeName: 'survey',
        statement: broadStatement('survey')
      });

      const afterSecond = await connection.sql(SQL`
        SELECT artifact.artifact_id, artifact.checksum_sha256, artifact.byte_size
        FROM artifact
        INNER JOIN download_version_artifact ON download_version_artifact.artifact_id = artifact.artifact_id
        WHERE download_version_artifact.download_version_id = ${downloadVersionId}
          AND download_version_artifact.record_end_date IS NULL;
      `);
      // Idempotency: same row count, same artifact_id, unchanged checksum + byte_size
      expect(afterSecond.rowCount).to.equal(1);
      expect(afterSecond.rows[0].artifact_id).to.equal(firstArtifactId);
      expect(afterSecond.rows[0].checksum_sha256).to.equal(firstChecksum);
      expect(String(afterSecond.rows[0].byte_size)).to.equal(String(firstByteSize));
    });

    it('inserts one artifact + one download_version_artifact row per feature type when the download has multiple types', async () => {
      stubParquetAndUpload();

      const submissionId = await createTestSubmission(connection);
      await createTestFeature(connection, submissionId, 'survey', { name: 'Multi DS' });
      await createTestFeature(connection, submissionId, 'capture', { comment: 'Multi cap' });
      const downloadId = await createPolicyDownload(['survey', 'capture']);
      const downloadVersionId = await createDownloadVersionFor(downloadId);
      const source = await downloadRepo.getDownloadSource(downloadId);

      await pipelineService.writeFeatureTypeParquet({
        downloadId,
        downloadVersionId,
        source,
        properties: emptyProperties,
        featureTypeName: 'survey',
        statement: broadStatement('survey')
      });
      await pipelineService.writeFeatureTypeParquet({
        downloadId,
        downloadVersionId,
        source,
        properties: emptyProperties,
        featureTypeName: 'capture',
        statement: broadStatement('capture')
      });

      const artifactRows = await connection.sql(SQL`
        SELECT artifact.artifact_id, artifact.object_key, download_version_artifact.download_version_id
        FROM artifact
        INNER JOIN download_version_artifact ON download_version_artifact.artifact_id = artifact.artifact_id
        WHERE download_version_artifact.download_version_id = ${downloadVersionId}
          AND download_version_artifact.record_end_date IS NULL
        ORDER BY artifact.object_key;
      `);
      expect(artifactRows.rowCount).to.equal(2);
      const objectKeys = artifactRows.rows.map((r: any) => r.object_key);
      expect(objectKeys).to.deep.equal([
        `downloads/${downloadId}/versions/${downloadVersionId}/capture/data.parquet`,
        `downloads/${downloadId}/versions/${downloadVersionId}/survey/data.parquet`
      ]);
      // Both rows link to the same materialized version
      for (const row of artifactRows.rows) {
        expect(row.download_version_id).to.equal(downloadVersionId);
      }
      // The two artifact_ids are distinct
      expect(artifactRows.rows[0].artifact_id).to.not.equal(artifactRows.rows[1].artifact_id);
    });
  });

  describe('export security filter — requested_by drives feature visibility', () => {
    /**
     * Run the feature-selection subquery the broad (no-expression) parquet path
     * uses, and return the produced submission_feature_id set.
     *
     * `writeFeatureTypeParquet` builds `buildBroadFeatureTypeSubquery(featureTypeName,
     * source.requested_by)` and streams its rows into the Parquet file. Driving the
     * same builder with `source.requested_by` is the load-bearing assertion: whatever
     * this set excludes never reaches the file. Asserting the id set directly avoids
     * stubbing the Parquet writer + S3 just to peek at what was streamed.
     */
    async function selectedFeatureIds(featureTypeName: string, requestedBy: number | null): Promise<Set<number>> {
      const subquery = buildBroadFeatureTypeSubquery(featureTypeName, requestedBy);
      const { sql, bindings } = subquery.toSQL().toNative();
      const result = await connection.query<{ submission_feature_id: number }>(sql, bindings as any[]);
      return new Set(result.rows.map((r) => r.submission_feature_id));
    }

    it('anonymous export (requested_by NULL) excludes a secured feature, includes its unsecured sibling', async () => {
      // AC #4 — an anonymous download must never package secured data. Two same-type
      // features in one submission; one is secured. The anonymous identity used to
      // build the export must strip the secured id while keeping the unsecured one.
      //
      // The export security filter (isEffectivelySecured) reads the precomputed closure, so
      // the secured feature is only recognised as secured once its closure self-loop exists. Seed both
      // siblings under a SHARED upload and rebuild the closure AFTER securing — without the rebuild the
      // empty closure reads securedId as unsecured and it would leak into the anonymous export.
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(connection, submissionId);
      const unsecuredId = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'survey'
      });
      const securedId = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'survey'
      });
      await secureFeature(connection, securedId);

      await new SubmissionFeatureClosureService(connection).computeClosureForUpload(uploadId);

      const { policy_id } = await policyService.createDownloadPolicy({
        name: `pq-sec-anon-${Date.now()}-${randomUUID().slice(0, 8)}`,
        description: null,
        featureTypes: ['survey'],
        expressionId: null
      });
      const { download_id } = await downloadService.createDownload({
        policyId: policy_id,
        format: 'parquet',
        requestedBy: null
      });
      const source = await downloadRepo.getDownloadSource(download_id);
      expect(source.requested_by).to.be.null;

      const ids = await selectedFeatureIds('survey', source.requested_by);
      expect(ids.has(unsecuredId)).to.equal(true);
      expect(ids.has(securedId)).to.equal(false);
    });

    it('authenticated export with grants includes the secured feature (authenticated path unchanged)', async () => {
      // AC #5 — a user with a scope grant to the secured feature still gets it in
      // their export. Same fixture as the anon case, but the export is built with the
      // granted user's id as requested_by.
      //
      // The closure rebuild is load-bearing here too: it makes isEffectivelySecured recognise
      // securedId as secured (Branch 1 fails), so visibility now hinges on the scope grant (Branch 2's
      // closure-anchor probe). WITHOUT the rebuild this test would pass spuriously — an empty closure
      // reads securedId as unsecured, so it would be "visible" regardless of any grant.
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(connection, submissionId);
      const unsecuredId = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'survey'
      });
      const securedId = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'survey'
      });
      await secureFeature(connection, securedId);

      await new SubmissionFeatureClosureService(connection).computeClosureForUpload(uploadId);

      const userId = connection.systemUserId();
      await setupFullAccess(connection, scopeRepo, `urn:${submissionId}:*:*`, userId, 'pq-export-access-team');

      const { policy_id } = await policyService.createDownloadPolicy({
        name: `pq-sec-auth-${Date.now()}-${randomUUID().slice(0, 8)}`,
        description: null,
        featureTypes: ['survey'],
        expressionId: null
      });
      const { download_id } = await downloadService.createDownload({
        policyId: policy_id,
        format: 'parquet',
        requestedBy: userId
      });
      const source = await downloadRepo.getDownloadSource(download_id);
      expect(source.requested_by).to.equal(userId);

      const ids = await selectedFeatureIds('survey', source.requested_by);
      expect(ids.has(unsecuredId)).to.equal(true);
      expect(ids.has(securedId)).to.equal(true);
    });
  });
});
