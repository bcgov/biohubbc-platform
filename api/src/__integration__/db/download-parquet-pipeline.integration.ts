// Integration test for the Parquet download pipeline — verifies the typed-table
// cursor + hydration path that reads from submission_feature_property_* tables
// and resolves code labels, taxon names, geometry GeoJSON, and JSONB fallback.
//
// Tests the repository methods that power DownloadPipelineService.streamParquetForType:
//   listDownloadFeatureTypesByCartId  →  streamFeatureBaseByCartIdAndType  →  fetchTypedPropertyRows
//
// Also covers: status transitions.
//
// Uses a transaction that is ROLLED BACK after each test, so no data is persisted.
//
// Run: make test-db
// Requires: make web (database must be running with seed data)

import * as parquetjs from '@dsnp/parquetjs';
import { expect } from 'chai';
import { randomInt } from 'node:crypto';
import sinon from 'sinon';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, getKnex, IDBConnection, initDBPool } from '../../database/db';
import { ApiConflictError } from '../../errors/api-error';
import { DATETIME_DATE_SUFFIX, DATETIME_TIME_SUFFIX } from '../../models/datetime-column';
import { ParquetFeatureData } from '../../models/download';
import { DownloadStatusEnum } from '../../models/download-status';
import { BaseFeatureRow, DownloadRepository } from '../../repositories/download/download-repository';
import { CartService } from '../../services/cart-service';
import { DownloadPipelineService } from '../../services/download/download-pipeline-service';
import { DownloadService } from '../../services/download/download-service';
import { ObjectStorageService } from '../../services/object-storage/object-storage-service';
import { CsvPropertyDefinition } from '../../utils/csv-utils';
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
 * for ArtifactService.insertArtifact and DownloadRepository.createDownloadArtifact
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
  let pipelineService: DownloadPipelineService;
  let downloadService: DownloadService;
  let cartService: CartService;

  before(() => {
    initDBPool(defaultPoolConfig);
  });

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    downloadRepo = new DownloadRepository(connection);
    pipelineService = new DownloadPipelineService(connection);
    downloadService = new DownloadService(connection);
    cartService = new CartService(connection);
  });

  afterEach(async () => {
    sinon.restore();
    await connection.rollback();
    connection.release();
  });

  // ── Helpers ──────────────────────────────────────────────────────────

  /**
   * Helper: create a cart from feature IDs and return the cart_id.
   */
  async function createCartWithFeatures(featureIds: number[]): Promise<string> {
    const systemUserId = connection.systemUserId();
    const cartResponse = await cartService.createCart(systemUserId, featureIds);
    return cartResponse.cart.cart_id;
  }

  /**
   * Helper: create a cart-backed download for the given feature IDs.
   * Returns the download_id.
   */
  async function createCartDownload(featureIds: number[]): Promise<string> {
    const cartId = await createCartWithFeatures(featureIds);
    const result = await downloadService.createDownload({ cartId, format: 'parquet' });
    return result.download_id;
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
   * contributor_codeset, and contributor_codeset_code.
   *
   * Mirrors the SIMS tarball submission flow (SIMSBIOHUB-911):
   *
   * 1. Contributors submit a tarball with `codes/codeset.json` defining their code vocabularies.
   *    The JSON has two levels — **categories** (codesets) and **codes within each category**:
   *    ```json
   *    {
   *      "sex": {                             ← codeset key → contributor_codeset.key
   *        "label": "Sex",                    ← codeset label → contributor_codeset.label
   *        "codes": {
   *          "male": {                        ← code key → contributor_codeset_code.key
   *            "label": "Male"                ← code label → contributor_codeset_code.label
   *          }
   *        }
   *      }
   *    }
   *    ```
   *
   * 2. Feature JSON references codes via slug: `{ "sex_code": "code::sex::male" }`
   *    where `sex` = codeset key, `male` = code key.
   *
   * 3. `parseCodeReference('code::sex::male')` extracts:
   *    `{ contributorCodesetKey: 'sex', contributorCodesetCodeKey: 'male' }`
   *
   * 4. Codeset ingestion (`CodesetIngestionService`) persists the two-level structure
   *    **per contributor** (`contributor_codeset.contributor_id` FK):
   *    - `contributor_codeset` = the **category** (e.g. "Sex") — groups related codes
   *      - `.key = 'sex'`, `.label = 'sex'`
   *    - `contributor_codeset_code` = a **code** within that category (e.g. "Male")
   *      - `.key = 'male'`, `.label = 'male'`
   *      - FK → `contributor_codeset_id` (which category this code belongs to)
   *
   *    Codesets are scoped to their contributor — they provide structured storage and
   *    FK integrity, not cross-contributor normalization. Two contributors can define
   *    different labels for the same biological concept (e.g. "male" vs "m").
   *
   * 5. The decompose service resolves the slug to `contributor_codeset_code_id` (FK)
   *    and inserts into `submission_feature_property_code`.
   *
   * 6. The Parquet pipeline JOINs to `contributor_codeset_code.label` → outputs `'male'`.
   *
   * This helper builds the full chain (steps 4–5) in a single transaction so the
   * integration test can verify step 6 (label resolution) against a real database.
   *
   * @param featureTypeName - The feature type to attach the property to (e.g. 'capture').
   * @param propertyName - The feature property name (e.g. 'sex_code') — the Parquet column header.
   * @param contributorCodesetKey - Codeset key (e.g. 'sex') — maps to `contributor_codeset.key`.
   * @param contributorCodesetCodeKey - Code key within the codeset (e.g. 'male') — maps to `contributor_codeset_code.key`.
   * @param codeLabel - The human-readable label, lowercased (e.g. 'male') — what the Parquet pipeline outputs.
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

    // Ensure 'code' feature_property_type exists (not in seed data)
    await connection.sql(SQL`
      INSERT INTO feature_property_type (name, record_effective_date, create_user)
      SELECT 'code', now(), ${systemUserId}
      WHERE NOT EXISTS (SELECT 1 FROM feature_property_type WHERE name = 'code');
    `);

    const codeTypeResult = await connection.sql(SQL`
      SELECT feature_property_type_id FROM feature_property_type WHERE name = 'code';
    `);
    const codeTypeId = codeTypeResult.rows[0].feature_property_type_id;

    // Insert feature_property
    const fpResult = await connection.sql(SQL`
      INSERT INTO feature_property (feature_property_type_id, name, display_name, record_effective_date, create_user)
      VALUES (${codeTypeId}, ${propertyName}, ${propertyName}, now(), ${systemUserId})
      RETURNING feature_property_id;
    `);
    const featurePropertyId = fpResult.rows[0].feature_property_id;

    // Insert feature_type_property linking this property to the feature type
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

    // Insert contributor_codeset — key matches the slug's contributorCodesetKey
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

    // Insert contributor_codeset_code — key matches the slug's contributorCodesetCodeKey
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
   *
   * @param featureTypeName - The feature type to attach the property to.
   * @param propertyName - The property name (e.g. 'species').
   * @param scientificName - The ITIS scientific name (e.g. 'Ursus arctos').
   * @returns { featureTypePropertyId, taxonId }
   */
  async function insertTaxonFeatureProperty(
    featureTypeName: string,
    propertyName: string,
    scientificName: string
  ): Promise<{ featureTypePropertyId: number; taxonId: number }> {
    const systemUserId = connection.systemUserId();

    // Look up taxon feature_property_type by name (avoid hardcoded ID)
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

    // Insert feature_type_property
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

    // Insert taxon row — use unique itis_tsn and suffix the scientific name to avoid
    // collision with seed data (taxon_nuk1 partial unique on itis_scientific_name)
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
   * Helper: stream all base feature rows for a given cart and feature type,
   * then hydrate them with typed property values.
   * Returns the hydrated ParquetFeatureData array.
   */
  async function streamAndHydrate(
    cartId: string,
    featureTypeName: string,
    properties: CsvPropertyDefinition[]
  ): Promise<ParquetFeatureData[]> {
    return hydrateFromStream(downloadRepo.streamFeatureBaseByCartIdAndType(cartId, featureTypeName, 100), properties);
  }

  /**
   * Helper: stream base feature rows via the filter (search query) path,
   * then hydrate with typed property values.
   * Uses a raw SQL subquery selecting submission_feature_ids by submission_id.
   */
  async function streamAndHydrateBySearch(
    downloadId: string,
    submissionId: number,
    featureTypeName: string,
    properties: CsvPropertyDefinition[]
  ): Promise<ParquetFeatureData[]> {
    const searchSql = 'SELECT submission_feature_id FROM submission_feature WHERE submission_id = $1';
    return hydrateFromStream(
      downloadRepo.streamFeatureBaseBySearchQueryAndType(downloadId, searchSql, [submissionId], featureTypeName, 100),
      properties
    );
  }

  /**
   * Helper: consume a base-feature-row stream and hydrate each batch with typed property values.
   * Collects the result into a flat array — fine for test-sized datasets.
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

  describe('listDownloadFeatureTypesByCartId', () => {
    it('should return distinct ordered feature type names for a cart', async () => {
      const submissionId = await createTestSubmission(connection);
      const datasetId = await createTestFeature(connection, submissionId, 'dataset', { name: 'DS' });
      const captureId = await createTestFeature(connection, submissionId, 'capture', { comment: 'cap' });
      const sampleSiteId = await createTestFeature(connection, submissionId, 'sample_site', { name: 'SS' });
      // Add a second dataset to verify deduplication
      const dataset2Id = await createTestFeature(connection, submissionId, 'dataset', { name: 'DS2' });

      const cartId = await createCartWithFeatures([datasetId, captureId, sampleSiteId, dataset2Id]);

      const featureTypes = await downloadRepo.listDownloadFeatureTypesByCartId(cartId);

      // Should be alphabetically ordered and deduplicated
      expect(featureTypes).to.deep.equal(['capture', 'dataset', 'sample_site']);
    });
  });

  describe('cursor + hydration', () => {
    it('should hydrate string, number, and datetime properties from typed tables', async () => {
      const submissionId = await createTestSubmission(connection);

      // Create a capture feature (has comment:string ftp_id=62, timestamp:datetime ftp_id=51)
      const captureFeatureId = await createTestFeature(connection, submissionId, 'capture', {
        comment: 'test capture'
      });

      // Create a measurement feature (has measurement_value:number ftp_id=29)
      const measurementFeatureId = await createTestFeature(connection, submissionId, 'measurement', {
        measurement_value: 42.5
      });

      // Insert typed property rows for capture
      await insertTypedPropertyRow('submission_feature_property_string', captureFeatureId, 62, 'Test comment value');
      await insertTypedPropertyRow('submission_feature_property_timestamp', captureFeatureId, 51, {
        date_value: '2024-06-15',
        time_value: '10:30:00'
      });

      // Insert typed property row for measurement
      await insertTypedPropertyRow('submission_feature_property_number', measurementFeatureId, 29, 42.5);

      // Stream and hydrate capture
      const captureCartId = await createCartWithFeatures([captureFeatureId]);
      const captureProperties: CsvPropertyDefinition[] = [
        { feature_property_name: 'comment', feature_property_type_name: 'string' },
        { feature_property_name: 'timestamp', feature_property_type_name: 'datetime' }
      ];

      const captureRows = await streamAndHydrate(captureCartId, 'capture', captureProperties);
      expect(captureRows).to.have.length(1);
      expect(captureRows[0].data.comment).to.equal('Test comment value');
      expect(captureRows[0].data.timestamp_date).to.equal('2024-06-15');
      expect(captureRows[0].data.timestamp_time).to.equal('10:30:00');

      // Stream and hydrate measurement
      const measurementCartId = await createCartWithFeatures([measurementFeatureId]);
      const measurementProperties: CsvPropertyDefinition[] = [
        { feature_property_name: 'measurement_value', feature_property_type_name: 'number' }
      ];

      const measurementRows = await streamAndHydrate(measurementCartId, 'measurement', measurementProperties);
      expect(measurementRows).to.have.length(1);
      // NUMERIC comes back as JS number due to custom parser
      expect(Number(measurementRows[0].data.measurement_value)).to.equal(42.5);
    });

    it('hydrates a date-only timestamp into <prop>_date with <prop>_time null', async () => {
      const submissionId = await createTestSubmission(connection);
      const captureFeatureId = await createTestFeature(connection, submissionId, 'capture', { comment: 'date-only' });
      await insertTypedPropertyRow('submission_feature_property_timestamp', captureFeatureId, 51, {
        date_value: '2024-06-15',
        time_value: null
      });

      const cartId = await createCartWithFeatures([captureFeatureId]);
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'timestamp', feature_property_type_name: 'datetime' }
      ];
      const rows = await streamAndHydrate(cartId, 'capture', properties);

      expect(rows).to.have.length(1);
      expect(rows[0].data.timestamp_date).to.equal('2024-06-15');
      // timestamp_time may be null (set by hydrator) or undefined (key never written) — accept both
      expect(rows[0].data.timestamp_time ?? null).to.be.null;
    });

    it('hydrates a time-only timestamp into <prop>_time with <prop>_date null', async () => {
      const submissionId = await createTestSubmission(connection);
      const captureFeatureId = await createTestFeature(connection, submissionId, 'capture', { comment: 'time-only' });
      await insertTypedPropertyRow('submission_feature_property_timestamp', captureFeatureId, 51, {
        date_value: null,
        time_value: '10:30:00'
      });

      const cartId = await createCartWithFeatures([captureFeatureId]);
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'timestamp', feature_property_type_name: 'datetime' }
      ];
      const rows = await streamAndHydrate(cartId, 'capture', properties);

      expect(rows).to.have.length(1);
      expect(rows[0].data.timestamp_date ?? null).to.be.null;
      expect(rows[0].data.timestamp_time).to.equal('10:30:00');
    });

    it('should resolve code property to contributor_codeset_code.label', async () => {
      const submissionId = await createTestSubmission(connection);
      // JSONB stores the code slug: code::<codesetKey>::<codeKey>
      // Property name is 'sex_code' to avoid collision with the existing 'sex' string property in seed data
      const captureFeatureId = await createTestFeature(connection, submissionId, 'capture', {
        sex_code: 'code::sex::male'
      });

      // Set up code property infrastructure — keys match the slug components,
      // label is lowercased by CodesetIngestionService during ingest (codeset-ingestion-service.ts:132)
      const { featureTypePropertyId, contributorCodesetCodeId } = await insertCodeFeatureProperty(
        'capture',
        'sex_code',
        'sex',
        'male',
        'male'
      );

      // Insert the code typed property row
      await insertTypedPropertyRow(
        'submission_feature_property_code',
        captureFeatureId,
        featureTypePropertyId,
        contributorCodesetCodeId
      );

      const cartId = await createCartWithFeatures([captureFeatureId]);
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'sex_code', feature_property_type_name: 'code' }
      ];

      const rows = await streamAndHydrate(cartId, 'capture', properties);
      expect(rows).to.have.length(1);
      expect(rows[0].data.sex_code).to.equal('male');
    });

    it('should resolve taxon property to taxon.itis_scientific_name', async () => {
      const submissionId = await createTestSubmission(connection);
      const captureFeatureId = await createTestFeature(connection, submissionId, 'capture', {
        species: 'Ursus arctos'
      });

      // Set up taxon property infrastructure
      const { featureTypePropertyId, taxonId } = await insertTaxonFeatureProperty('capture', 'species', 'Ursus arctos');

      // Insert the taxon typed property row
      await insertTypedPropertyRow(
        'submission_feature_property_taxon',
        captureFeatureId,
        featureTypePropertyId,
        taxonId
      );

      const cartId = await createCartWithFeatures([captureFeatureId]);
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'species', feature_property_type_name: 'taxon' }
      ];

      const rows = await streamAndHydrate(cartId, 'capture', properties);
      expect(rows).to.have.length(1);
      // Scientific name includes a test suffix to avoid seed data collision
      expect(rows[0].data.species).to.be.a('string');
      expect(rows[0].data.species).to.include('Ursus arctos');
    });

    it('should return geometry as GeoJSON object', async () => {
      const submissionId = await createTestSubmission(connection);
      const sampleSiteFeatureId = await createTestFeature(connection, submissionId, 'sample_site', {
        name: 'Geo Site'
      });

      const geoJson = JSON.stringify({
        type: 'Point',
        coordinates: [-123.3656, 48.4284]
      });

      // sample_site geometry is ftp_id = 4
      await insertTypedPropertyRow('submission_feature_property_geometry', sampleSiteFeatureId, 4, geoJson);

      const cartId = await createCartWithFeatures([sampleSiteFeatureId]);
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'geometry', feature_property_type_name: 'spatial' }
      ];

      const rows = await streamAndHydrate(cartId, 'sample_site', properties);
      expect(rows).to.have.length(1);

      const geom = rows[0].data.geometry;
      expect(geom).to.not.be.null;
      expect(geom.type).to.equal('Point');
      expect(geom.coordinates).to.be.an('array');
      expect(geom.coordinates).to.have.length(2);
    });

    it('should populate parent_uuid for child features', async () => {
      const submissionId = await createTestSubmission(connection);
      const parentFeatureId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Parent DS' });
      const childFeatureId = await createTestFeature(
        connection,
        submissionId,
        'capture',
        { comment: 'child' },
        parentFeatureId
      );

      // Get parent's uuid for verification
      const parentRow = await connection.sql(SQL`
        SELECT uuid FROM submission_feature WHERE submission_feature_id = ${parentFeatureId};
      `);
      const parentUuid = parentRow.rows[0].uuid;

      const cartId = await createCartWithFeatures([childFeatureId]);
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'comment', feature_property_type_name: 'string' }
      ];

      const rows = await streamAndHydrate(cartId, 'capture', properties);
      expect(rows).to.have.length(1);
      expect(rows[0].parent_uuid).to.equal(parentUuid);
    });

    it('should return null for properties missing from typed tables', async () => {
      const submissionId = await createTestSubmission(connection);
      const captureFeatureId = await createTestFeature(connection, submissionId, 'capture', { comment: 'partial' });

      // Only insert a string typed row for 'comment' — no timestamp row
      await insertTypedPropertyRow('submission_feature_property_string', captureFeatureId, 62, 'Partial data');

      const cartId = await createCartWithFeatures([captureFeatureId]);
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'comment', feature_property_type_name: 'string' },
        { feature_property_name: 'timestamp', feature_property_type_name: 'datetime' }
      ];

      const rows = await streamAndHydrate(cartId, 'capture', properties);
      expect(rows).to.have.length(1);
      expect(rows[0].data.comment).to.equal('Partial data');
      // datetime expands to two keys; both null when no typed row exists
      expect(rows[0].data.timestamp_date).to.be.null;
      expect(rows[0].data.timestamp_time).to.be.null;
    });

    it('should fall back to JSONB for array properties', async () => {
      const submissionId = await createTestSubmission(connection);
      // The JSONB fallback reads from data.properties.propName — structure the data accordingly
      const datasetFeatureId = await createTestFeature(connection, submissionId, 'dataset', {
        name: 'Array Test',
        properties: { focal_species: ['bear', 'elk'] }
      });

      const cartId = await createCartWithFeatures([datasetFeatureId]);
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'focal_species', feature_property_type_name: 'array' }
      ];

      const rows = await streamAndHydrate(cartId, 'dataset', properties);
      expect(rows).to.have.length(1);
      expect(rows[0].data.focal_species).to.deep.equal(['bear', 'elk']);
    });

    it('should hydrate multiple features in same batch without cross-contamination', async () => {
      const submissionId = await createTestSubmission(connection);

      // Two capture features with different string values for the same property
      const feature1 = await createTestFeature(connection, submissionId, 'capture', { comment: 'first' });
      const feature2 = await createTestFeature(connection, submissionId, 'capture', { comment: 'second' });

      await insertTypedPropertyRow('submission_feature_property_string', feature1, 62, 'Alpha');
      await insertTypedPropertyRow('submission_feature_property_string', feature2, 62, 'Beta');

      const cartId = await createCartWithFeatures([feature1, feature2]);
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'comment', feature_property_type_name: 'string' }
      ];

      const rows = await streamAndHydrate(cartId, 'capture', properties);
      expect(rows).to.have.length(2);

      // Verify properties are assigned to the correct feature (not swapped)
      rows.sort((a, b) => a.submission_feature_id - b.submission_feature_id);
      expect(rows[0].data.comment).to.equal('Alpha');
      expect(rows[1].data.comment).to.equal('Beta');
    });
  });

  describe('filter-based cursor (search query path)', () => {
    it('should stream and hydrate features via search subquery with correct binding order', async () => {
      const submissionId = await createTestSubmission(connection);
      const captureFeatureId = await createTestFeature(connection, submissionId, 'capture', {
        comment: 'filter path'
      });

      // Also create a dataset feature — should NOT appear when filtering by 'capture'
      await createTestFeature(connection, submissionId, 'dataset', { name: 'Decoy' });

      await insertTypedPropertyRow('submission_feature_property_string', captureFeatureId, 62, 'Filter value');

      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'comment', feature_property_type_name: 'string' }
      ];

      // Use a fake downloadId for cursor naming — the filter path doesn't need a real download record
      const rows = await streamAndHydrateBySearch('test-filter-dl', submissionId, 'capture', properties);
      expect(rows).to.have.length(1);
      expect(rows[0].data.comment).to.equal('Filter value');
      expect(rows[0].feature_type_name).to.equal('capture');
    });

    it('should list feature types via search subquery', async () => {
      const submissionId = await createTestSubmission(connection);
      await createTestFeature(connection, submissionId, 'dataset', { name: 'DS' });
      await createTestFeature(connection, submissionId, 'capture', { comment: 'cap' });
      await createTestFeature(connection, submissionId, 'dataset', { name: 'DS2' });

      const knex = getKnex();
      const searchSubquery = knex('submission_feature')
        .select('submission_feature_id')
        .where({ submission_id: submissionId });

      const featureTypes = await downloadRepo.listDownloadFeatureTypesBySearchQuery(searchSubquery);
      expect(featureTypes).to.deep.equal(['capture', 'dataset']);
    });
  });

  describe('status transitions', () => {
    it('should transition download status from pending to processing to ready', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Status Test' });
      const downloadId = await createCartDownload([featureId]);

      // Verify initial state
      const initial = await downloadService.findDownloadById(downloadId);
      expect(initial!.download_status).to.equal(DownloadStatusEnum.PENDING);
      expect(initial!.started_at).to.be.null;
      expect(initial!.completed_at).to.be.null;

      // pending → processing: started_at populated, completed_at still null
      await pipelineService.transitionDownloadStatus(downloadId, DownloadStatusEnum.PROCESSING, [
        DownloadStatusEnum.PENDING
      ]);
      const processing = await downloadService.findDownloadById(downloadId);
      expect(processing!.download_status).to.equal(DownloadStatusEnum.PROCESSING);
      expect(processing!.started_at).to.not.be.null;
      expect(processing!.completed_at).to.be.null;

      const firstStartedAt = processing!.started_at;

      // processing → ready: completed_at populated, started_at unchanged
      await pipelineService.transitionDownloadStatus(downloadId, DownloadStatusEnum.READY, [
        DownloadStatusEnum.PROCESSING
      ]);
      const ready = await downloadService.findDownloadById(downloadId);
      expect(ready!.download_status).to.equal(DownloadStatusEnum.READY);
      expect(ready!.started_at).to.equal(firstStartedAt);
      expect(ready!.completed_at).to.not.be.null;

      // Illegal transition: retrying processing → ready on a READY download throws ApiConflictError
      try {
        await pipelineService.transitionDownloadStatus(downloadId, DownloadStatusEnum.READY, [
          DownloadStatusEnum.PROCESSING
        ]);
        expect.fail('Expected ApiConflictError for illegal transition from READY');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiConflictError);
      }
    });
  });

  describe('writeFeatureTypeParquet — artifact + download_artifact rows', () => {
    // ParquetWriter is stubbed — no properties are resolved against typed tables, so
    // an empty property list is safe and minimizes test surface area.
    const emptyProperties: CsvPropertyDefinition[] = [];

    const stubStatement = (urn_feature_type: string) => ({
      policy_statement_id: '00000000-0000-0000-0000-000000000001',
      urn_feature_type,
      expression_id: null
    });

    it('inserts one artifact + one download_artifact row for a single feature type', async () => {
      stubParquetAndUpload();

      const submissionId = await createTestSubmission(connection);
      const datasetId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Happy path dataset' });
      const downloadId = await createCartDownload([datasetId]);
      const source = await downloadRepo.getDownloadSource(downloadId);

      await pipelineService.writeFeatureTypeParquet({
        downloadId,
        source,
        properties: emptyProperties,
        featureTypeName: 'dataset',
        statement: stubStatement('dataset')
      });

      const artifactRows = await connection.sql(SQL`
        SELECT artifact.artifact_id, artifact.bucket, artifact.object_key, artifact.byte_size,
               artifact.checksum_sha256, artifact.artifact_status, artifact.format, artifact.uploaded_at
        FROM artifact
        INNER JOIN download_artifact ON download_artifact.artifact_id = artifact.artifact_id
        WHERE download_artifact.download_id = ${downloadId}
          AND download_artifact.record_end_date IS NULL;
      `);
      expect(artifactRows.rowCount).to.equal(1);

      const artifact = artifactRows.rows[0];
      expect(artifact.format).to.equal('parquet');
      expect(artifact.artifact_status).to.equal('uploaded');
      expect(artifact.object_key).to.equal(`downloads/${downloadId}/dataset/data.parquet`);
      expect(artifact.bucket).to.be.a('string').and.have.length.greaterThan(0);
      expect(artifact.checksum_sha256).to.match(/^[0-9a-f]{64}$/);
      expect(Number(artifact.byte_size)).to.be.at.least(0);
      expect(artifact.uploaded_at).to.not.be.null;

      // Explicit FK linkage: download_artifact.artifact_id matches artifact.artifact_id
      const linkRows = await connection.sql(SQL`
        SELECT artifact_id, download_id
        FROM download_artifact
        WHERE download_id = ${downloadId}
          AND record_end_date IS NULL;
      `);
      expect(linkRows.rowCount).to.equal(1);
      expect(linkRows.rows[0].artifact_id).to.equal(artifact.artifact_id);
      expect(linkRows.rows[0].download_id).to.equal(downloadId);

      // download status untouched — writeFeatureTypeParquet does not transition status
      const download = await downloadService.findDownloadById(downloadId);
      expect(download!.download_status).to.equal(DownloadStatusEnum.PENDING);
    });

    it('is idempotent on retry — second call does not create a duplicate artifact or download_artifact row', async () => {
      stubParquetAndUpload();

      const submissionId = await createTestSubmission(connection);
      const datasetId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Retry dataset' });
      const downloadId = await createCartDownload([datasetId]);
      const source = await downloadRepo.getDownloadSource(downloadId);

      // Call 1
      await pipelineService.writeFeatureTypeParquet({
        downloadId,
        source,
        properties: emptyProperties,
        featureTypeName: 'dataset',
        statement: stubStatement('dataset')
      });

      const afterFirst = await connection.sql(SQL`
        SELECT artifact.artifact_id, artifact.checksum_sha256, artifact.byte_size
        FROM artifact
        INNER JOIN download_artifact ON download_artifact.artifact_id = artifact.artifact_id
        WHERE download_artifact.download_id = ${downloadId}
          AND download_artifact.record_end_date IS NULL;
      `);
      expect(afterFirst.rowCount).to.equal(1);
      const firstArtifactId = afterFirst.rows[0].artifact_id;
      const firstChecksum = afterFirst.rows[0].checksum_sha256;
      const firstByteSize = afterFirst.rows[0].byte_size;

      // Call 2 — same download, same feature type
      await pipelineService.writeFeatureTypeParquet({
        downloadId,
        source,
        properties: emptyProperties,
        featureTypeName: 'dataset',
        statement: stubStatement('dataset')
      });

      const afterSecond = await connection.sql(SQL`
        SELECT artifact.artifact_id, artifact.checksum_sha256, artifact.byte_size
        FROM artifact
        INNER JOIN download_artifact ON download_artifact.artifact_id = artifact.artifact_id
        WHERE download_artifact.download_id = ${downloadId}
          AND download_artifact.record_end_date IS NULL;
      `);
      // Idempotency: same row count, same artifact_id, unchanged checksum + byte_size
      expect(afterSecond.rowCount).to.equal(1);
      expect(afterSecond.rows[0].artifact_id).to.equal(firstArtifactId);
      expect(afterSecond.rows[0].checksum_sha256).to.equal(firstChecksum);
      expect(String(afterSecond.rows[0].byte_size)).to.equal(String(firstByteSize));
    });

    it('inserts one artifact + one download_artifact row per feature type when the download has multiple types', async () => {
      stubParquetAndUpload();

      const submissionId = await createTestSubmission(connection);
      const datasetId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Multi DS' });
      const captureId = await createTestFeature(connection, submissionId, 'capture', { comment: 'Multi cap' });
      const downloadId = await createCartDownload([datasetId, captureId]);
      const source = await downloadRepo.getDownloadSource(downloadId);

      await pipelineService.writeFeatureTypeParquet({
        downloadId,
        source,
        properties: emptyProperties,
        featureTypeName: 'dataset',
        statement: stubStatement('dataset')
      });
      await pipelineService.writeFeatureTypeParquet({
        downloadId,
        source,
        properties: emptyProperties,
        featureTypeName: 'capture',
        statement: stubStatement('capture')
      });

      const artifactRows = await connection.sql(SQL`
        SELECT artifact.artifact_id, artifact.object_key, download_artifact.download_id
        FROM artifact
        INNER JOIN download_artifact ON download_artifact.artifact_id = artifact.artifact_id
        WHERE download_artifact.download_id = ${downloadId}
          AND download_artifact.record_end_date IS NULL
        ORDER BY artifact.object_key;
      `);
      expect(artifactRows.rowCount).to.equal(2);
      const objectKeys = artifactRows.rows.map((r: any) => r.object_key);
      expect(objectKeys).to.deep.equal([
        `downloads/${downloadId}/capture/data.parquet`,
        `downloads/${downloadId}/dataset/data.parquet`
      ]);
      // Both rows link to the same download
      for (const row of artifactRows.rows) {
        expect(row.download_id).to.equal(downloadId);
      }
      // The two artifact_ids are distinct
      expect(artifactRows.rows[0].artifact_id).to.not.equal(artifactRows.rows[1].artifact_id);
    });
  });
});
