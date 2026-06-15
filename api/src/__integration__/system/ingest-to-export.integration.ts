// System integration test: end-to-end cart → download → export → CSV.
//
// Mirrors `scripts/test_telemetry_export.py` end-to-end, against a real DB +
// MinIO. The pipeline reads telemetry from `submission_feature` + the typed
// `submission_feature_property_*` tables (populated upstream by 963's indexing
// job), runs the Parquet pipeline, then the CSV export pipeline, and writes a
// part-zip to S3. We then unzip and assert the CSV contents.
//
// Run: make test-sys
// Requires: make web (database + MinIO must be running)

import AdmZip from 'adm-zip';
import { expect } from 'chai';
import sinon from 'sinon';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { DownloadStatusEnum } from '../../models/download-status';
import { DownloadRepository } from '../../repositories/download/download-repository';
import { DownloadVersionRepository } from '../../repositories/download/download-version-repository';
import { DownloadExportPipelineService } from '../../services/download/download-export-pipeline-service';
import { DownloadExportService } from '../../services/download/download-export-service';
import { DownloadPipelineService } from '../../services/download/download-pipeline-service';
import { DownloadPolicyService } from '../../services/download/download-policy-service';
import { DownloadService } from '../../services/download/download-service';
import { BucketType, ObjectStorageService } from '../../services/object-storage/object-storage-service';
import { createTestFeature, createTestSubmission } from '../helpers/test-submission-helpers';

/** Download a zip file from S3 and return it as an AdmZip instance. */
async function downloadZipFromS3(storageService: ObjectStorageService, s3Key: string): Promise<AdmZip> {
  const fileStream = await storageService.getFileStream(BucketType.MAIN, s3Key);
  const chunks: Buffer[] = [];
  for await (const chunk of fileStream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return new AdmZip(Buffer.concat(chunks));
}

/** Read a zip entry as a UTF-8 string. */
function zipEntryText(zip: AdmZip, entry: string): string {
  return zip.readFile(entry)?.toString('utf-8') ?? '';
}

describe('Ingest → Download → Export (system integration)', function () {
  // Real Parquet round-trip + S3 multipart upload is slow; give it headroom.
  this.timeout(60000);

  let connection: IDBConnection;

  before(() => {
    initDBPool(defaultPoolConfig);
  });

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    // This spec drives the export pipeline directly via `runExportGroup`; stub the job publish so
    // the request path doesn't enqueue a real pg-boss job (which the worker would then process
    // concurrently with the manual run) and doesn't require an initialized pg-boss in the test process.
    sinon.stub(DownloadExportService.dependencies, 'publishProcessDownloadVersionExportJob').resolves();
  });

  afterEach(async () => {
    sinon.restore();
    await connection.rollback();
    connection.release();
  });

  /**
   * Look up the active feature_type_property_id for a (feature_type, property) pair.
   * Hardcoding seed IDs is brittle; this name-based lookup mirrors how the
   * indexer resolves them at runtime.
   */
  async function lookupFeatureTypePropertyId(featureTypeName: string, propertyName: string): Promise<number> {
    const result = await connection.sql(SQL`
      SELECT ftp.feature_type_property_id
      FROM feature_type_property ftp
      INNER JOIN feature_type ft ON ft.feature_type_id = ftp.feature_type_id
      INNER JOIN feature_property fp ON fp.feature_property_id = ftp.feature_property_id
      WHERE ft.name = ${featureTypeName}
        AND fp.name = ${propertyName}
        AND ftp.record_end_date IS NULL
      LIMIT 1;
    `);
    if (!result.rowCount) {
      throw new Error(`feature_type_property not found: ${featureTypeName}.${propertyName}`);
    }
    return result.rows[0].feature_type_property_id as number;
  }

  /**
   * Mirror what 963's indexer would write for a telemetry feature: one row per
   * declared property in the matching typed table. The download pipeline reads
   * from these typed tables, so without them the CSV renders empty cells.
   */
  async function indexTelemetryProperties(
    submissionFeatureId: number,
    data: { dop: number; elevation: number; timestamp: string; geometry: object }
  ): Promise<void> {
    const systemUserId = connection.systemUserId();

    const dopId = await lookupFeatureTypePropertyId('telemetry', 'dop');
    const elevationId = await lookupFeatureTypePropertyId('telemetry', 'elevation');
    const timestampId = await lookupFeatureTypePropertyId('telemetry', 'timestamp');
    const geometryId = await lookupFeatureTypePropertyId('telemetry', 'geometry');

    await connection.sql(SQL`
      INSERT INTO submission_feature_property_number (submission_feature_id, feature_type_property_id, value, create_user)
      VALUES
        (${submissionFeatureId}, ${dopId}, ${data.dop}, ${systemUserId}),
        (${submissionFeatureId}, ${elevationId}, ${data.elevation}, ${systemUserId});
    `);
    // The timestamp table stores partial-component datetimes — split the ISO
    // string into date + time at the call site (the boundary that has the
    // intent context). The repo doesn't coerce; the DB CHECK enforces
    // at-least-one-non-null.
    const dateValue = data.timestamp.slice(0, 10);
    const timeValue = data.timestamp.slice(11, 19);
    await connection.sql(SQL`
      INSERT INTO submission_feature_property_timestamp
        (submission_feature_id, feature_type_property_id, date_value, time_value, create_user)
      VALUES (${submissionFeatureId}, ${timestampId}, ${dateValue}::date, ${timeValue}::time, ${systemUserId});
    `);
    // Geometry uses ST_GeomFromGeoJSON; pass the inner Feature.geometry, not the FeatureCollection wrapper.
    const innerGeom = (data.geometry as any)?.features?.[0]?.geometry ?? data.geometry;
    await connection.query(
      `INSERT INTO submission_feature_property_geometry (submission_feature_id, feature_type_property_id, value, create_user)
       VALUES ($1, $2, ST_GeomFromGeoJSON($3), $4)`,
      [submissionFeatureId, geometryId, JSON.stringify(innerGeom), systemUserId]
    );
  }

  it('telemetry: cart → download → export round-trips to CSV with submission_feature_id, uuid, parent_uuid, and every property column', async () => {
    const submissionId = await createTestSubmission(connection);

    const telemetryData = {
      dop: 4.2,
      elevation: 1234.5,
      timestamp: '2026-04-24T12:34:56.789Z',
      geometry: {
        type: 'FeatureCollection' as const,
        features: [
          {
            type: 'Feature' as const,
            properties: {},
            geometry: { type: 'Point' as const, coordinates: [-123.1234, 49.5678] }
          }
        ]
      }
    };

    const featureId = await createTestFeature(connection, submissionId, 'telemetry', telemetryData);
    await indexTelemetryProperties(featureId, telemetryData);

    // Build a download policy + download via the real services. Broad-path
    // policy on the telemetry feature type — at export time the security
    // filter is applied for the policy creator's authorization scope.
    const systemUserId = connection.systemUserId();
    const policyService = new DownloadPolicyService(connection);
    const { policy_id } = await policyService.createDownloadPolicy({
      name: 'ingest-to-export integration test',
      description: null,
      featureTypes: ['telemetry'],
      expressionId: null
    });

    const downloadService = new DownloadService(connection);
    const { download_id: downloadId } = await downloadService.createDownload({
      policyId: policy_id,
      format: 'parquet',
      requestedBy: connection.systemUserId()
    });

    // Materialize the download's version. The parquet pipeline links each artifact to this version,
    // and runExportGroup discovers feature types from it; reads resolve the most-recent version, so
    // there is no stored "current version" pointer to set.
    const downloadVersionRepo = new DownloadVersionRepository(connection);
    const version = await downloadVersionRepo.createDownloadVersion(downloadId);
    const downloadVersionId = version.download_version_id;

    // Run the download (Parquet) pipeline.
    const pipelineService = new DownloadPipelineService(connection);
    await pipelineService.transitionDownloadVersionStatus(downloadVersionId, DownloadStatusEnum.PROCESSING, [
      DownloadStatusEnum.PENDING
    ]);
    const source = await new DownloadRepository(connection).getDownloadSource(downloadId);
    const { schemaLookup, statements } = await pipelineService.resolveParquetSchema(source);
    for (const statement of statements) {
      const featureTypeName = statement.urn_feature_type;
      await pipelineService.writeFeatureTypeParquet({
        downloadId,
        downloadVersionId,
        source,
        properties: schemaLookup.get(featureTypeName) ?? [],
        featureTypeName,
        statement
      });
    }
    await pipelineService.transitionDownloadVersionStatus(downloadVersionId, DownloadStatusEnum.READY, [
      DownloadStatusEnum.PROCESSING
    ]);

    // Run the export (CSV) pipeline through the resolve-or-create group contract.
    // Per-feature-type recipe over the one materialized type (telemetry), all
    // columns (no output_columns) — the pre-config-driven behaviour this test
    // asserts on (the full telemetry CSV header).
    const exportService = new DownloadExportService(connection);
    const exportRecord = await exportService.createDownloadVersionExport(
      downloadId,
      systemUserId,
      {
        download_version_id: downloadVersionId,
        version: 1,
        export_type: 'csv',
        mode: 'per_feature_type',
        feature_types: ['telemetry'],
        merge_steps: []
      },
      connection
    );
    // The export record no longer exposes the internal artifact-group FK (it is server-only), so the
    // group id is read straight from the row to drive the pipeline and locate its part-zips.
    const exportGroup = await connection.sql(SQL`
      SELECT download_version_export_artifact_group_id
      FROM download_version_export
      WHERE download_version_export_id = ${exportRecord.download_version_export_id};
    `);
    const groupId = exportGroup.rows[0].download_version_export_artifact_group_id;
    const exportPipelineService = new DownloadExportPipelineService(connection);
    await exportPipelineService.runExportGroup(groupId);

    // Locate the part-zip on S3 and extract chunk1.csv. Part artifacts are linked to the shared
    // artifact GROUP (keyed by the group id), not the per-user export row.
    const artifacts = await connection.sql(SQL`
      SELECT a.bucket, a.object_key
      FROM download_version_export_artifact dvea
      INNER JOIN artifact a ON a.artifact_id = dvea.artifact_id
      WHERE dvea.download_version_export_artifact_group_id = ${groupId}
        AND dvea.record_end_date IS NULL
      ORDER BY dvea.chunk_id ASC;
    `);
    expect(artifacts.rowCount).to.equal(1, 'expected exactly one part-zip artifact');

    const storageService = new ObjectStorageService();
    const zip = await downloadZipFromS3(storageService, artifacts.rows[0].object_key);
    // The physical zip is shared across exports, so its internal entry names are keyed by the group id.
    const chunkEntryName = `biohub-export-${groupId}/telemetry/chunk1.csv`;
    const csv = zipEntryText(zip, chunkEntryName);
    expect(csv, 'expected chunk1.csv to be present in the part-zip').to.not.equal('');

    const lines = csv.trim().split('\n');
    // The broad-path policy projects every active telemetry feature, so the CSV
    // may also contain rows from seed data — assert this test's row is present
    // rather than asserting exclusivity.
    expect(lines.length, 'expected header + at least the test data row').to.be.greaterThan(1);

    const header = lines[0].split(',');
    // System columns lead so consumers can join cross-file (uuid, parent_uuid)
    // and trace back to the platform UI (submission_feature_id).
    expect(header).to.include.members(['submission_feature_id', 'uuid', 'parent_uuid']);
    // `datetime` properties expand into two output columns (`<prop>_date`,
    // `<prop>_time`) so partial-component values remain first-class for
    // columnar predicate pushdown.
    expect(header).to.include.members(['dop', 'elevation', 'timestamp_date', 'timestamp_time', 'geometry']);

    const featureIdIdx = header.indexOf('submission_feature_id');
    const dataRow = lines
      .slice(1)
      .map((line) => line.split(','))
      .find((cells) => cells[featureIdIdx] === String(featureId));
    expect(dataRow, `expected a data row for submission_feature_id=${featureId}`).to.not.be.undefined;
    const row = dataRow!;
    const col = (name: string): string => row[header.indexOf(name)];

    expect(col('submission_feature_id')).to.equal(String(featureId));
    // uuid is generated server-side; we don't pin the exact value, just assert it's a non-empty UUID-looking string.
    expect(col('uuid')).to.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    // Telemetry's parent (the dataset) is set inside createTestFeature → empty for root-level test feature.
    // Real telemetry has a dataset parent; the column at minimum must be present (not crash).
    expect(header).to.include('parent_uuid');

    expect(col('dop'), 'dop should round-trip the ingested number').to.equal('4.2');
    expect(col('elevation'), 'elevation should round-trip the ingested number').to.equal('1234.5');
    expect(col('timestamp_date'), 'timestamp_date should round-trip the ingested date component').to.equal(
      '2026-04-24'
    );
    expect(col('timestamp_time'), 'timestamp_time should round-trip the ingested time component').to.equal('12:34:56');
    // Geometry is emitted as a single WKT column (per Phase 5 of plan-review-fixes).
    expect(col('geometry'), 'geometry should be a Point WKT').to.match(/^POINT\(-123\.1234\s+49\.5678\)$/);
  });
});
