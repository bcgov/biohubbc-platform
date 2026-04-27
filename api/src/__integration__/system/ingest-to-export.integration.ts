// System integration test: end-to-end ingest → download → export.
//
// The single case here is the one regression test that would have caught the
// empty-telemetry-export symptom in SIMSBIOHUB-954, and the deeper wiring gap
// it exposed: nothing in runtime populates the `submission_feature_property_*`
// tables that `DownloadPipelineService.hydrateFeatureBatch` reads from. Real
// ingested data flows `submission_feature.data` (JSONB) → `search_*` (via the
// index job), never into the typed tables — so the download pipeline, which
// reads the typed tables, silently emits nulls for every property except
// `uuid`, `parent_uuid`, and `geometry` (which has its own seed helper).
//
// This file is `.skip`ped until that wiring gap is addressed. The assertions
// are the acceptance criteria for the follow-up: when the pipeline either
// hydrates from JSONB or gets a post-ingest populator job for the typed
// tables, un-skip this and the test passes.
//
// Run: make test-sys
// Requires: make web (database + MinIO must be running)

import AdmZip from 'adm-zip';
import { expect } from 'chai';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { DownloadStatusEnum } from '../../models/download-status';
import { DownloadRepository } from '../../repositories/download/download-repository';
import { CartService } from '../../services/cart-service';
import { DownloadExportPipelineService } from '../../services/download/download-export-pipeline-service';
import { DownloadExportService } from '../../services/download/download-export-service';
import { DownloadPipelineService } from '../../services/download/download-pipeline-service';
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
  });

  afterEach(async () => {
    await connection.rollback();
    connection.release();
  });

  // ── Pending: design bug covered in follow-up ─────────────────────────────
  //
  // Reason it's skipped: `DownloadPipelineService.hydrateFeatureBatch` reads
  // from `submission_feature_property_*` tables, but runtime code never
  // writes to those tables (verified across the entire codebase — only seed
  // helpers and integration-test fixtures INSERT). The real ingest path
  // (`FeatureIngestionRepository.insertSubmissionFeatureRecords`) only
  // populates `submission_feature.data` JSONB; the indexing job
  // (`SearchFeatureService.indexFeaturesBySubmissionId`) only populates
  // `search_*` tables. So every real-ingested feature's Parquet row ends up
  // with null-filled typed columns, and the exported CSV renders with
  // empty cells — the exact symptom we hit on telemetry.
  //
  // When the design bug is fixed (see follow-up ticket), un-skip this test.
  // If it passes, the pipeline correctly round-trips ingested data through
  // to the CSV without depending on anything outside the runtime write path.
  it.skip('telemetry: ingested feature data round-trips to CSV with real values for every property type', async () => {
    const submissionId = await createTestSubmission(connection);

    // Real-ingested shape: keys match the declared telemetry
    // feature_type_property schema (dop, elevation, timestamp, geometry) and
    // geometry is a full FeatureCollection to match the ingest validator's
    // `GeoJSONFeatureCollectionZodSchema` contract.
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
            geometry: {
              type: 'Point' as const,
              coordinates: [-123.1234, 49.5678]
            }
          }
        ]
      }
    };

    // Use the test helper that mirrors what real ingestion does — inserts
    // into submission_feature only, does NOT touch submission_feature_property_*.
    // This is the critical shape of the test: we're asserting the pipeline
    // works on data written exactly the way real ingestion writes it.
    const featureId = await createTestFeature(connection, submissionId, 'telemetry', telemetryData);

    // Build a cart + download via the real services.
    const systemUserId = connection.systemUserId();
    const cartService = new CartService(connection);
    const { cart } = await cartService.createCart(systemUserId, [featureId]);

    const downloadService = new DownloadService(connection);
    const { download_id: downloadId } = await downloadService.createDownload({
      cartId: cart.cart_id,
      format: 'parquet'
    });

    // Run the download pipeline. Transitions PENDING → PROCESSING, writes
    // one Parquet file per feature type to S3, then PROCESSING → READY.
    const pipelineService = new DownloadPipelineService(connection);
    await pipelineService.transitionDownloadStatus(downloadId, DownloadStatusEnum.PROCESSING, [
      DownloadStatusEnum.PENDING
    ]);

    const source = await new DownloadRepository(connection).getDownloadSource(downloadId);
    const { schemaLookup, featureTypes } = await pipelineService.resolveParquetSchema(downloadId, source);
    for (const featureTypeName of featureTypes) {
      await pipelineService.writeFeatureTypeParquet({
        downloadId,
        source,
        properties: schemaLookup.get(featureTypeName) ?? [],
        featureTypeName
      });
    }
    await pipelineService.transitionDownloadStatus(downloadId, DownloadStatusEnum.READY, [
      DownloadStatusEnum.PROCESSING
    ]);

    // Create + run the export.
    const exportService = new DownloadExportService(connection);
    const exportRecord = await exportService.createDownloadExport(downloadId, systemUserId, {});
    const exportPipelineService = new DownloadExportPipelineService(connection);
    await exportPipelineService.runExport(exportRecord.download_export_id);

    // Locate the single part-zip on S3 and extract chunk1.csv.
    const artifacts = await connection.sql(SQL`
      SELECT a.bucket, a.object_key
      FROM download_export_artifact dea
      INNER JOIN artifact a ON a.artifact_id = dea.artifact_id
      WHERE dea.download_export_id = ${exportRecord.download_export_id}
        AND dea.record_end_date IS NULL
      ORDER BY dea.chunk_id ASC;
    `);
    expect(artifacts.rowCount).to.equal(1);

    const storageService = new ObjectStorageService();
    const zip = await downloadZipFromS3(storageService, artifacts.rows[0].object_key);
    const chunkEntryName = `biohub-export-${exportRecord.download_export_id}/telemetry/chunk1.csv`;
    const csv = zipEntryText(zip, chunkEntryName);

    // The acceptance criteria: header present, exactly one data row, and every
    // declared column carries the ingested value (not the null-filled empty
    // string we see today).
    const lines = csv.trim().split('\n');
    expect(lines).to.have.lengthOf(2, 'expected header + 1 data row');

    const header = lines[0].split(',');
    expect(header).to.include.members(['dop', 'elevation', 'timestamp', 'decimalLatitude', 'decimalLongitude']);

    const row = lines[1].split(',');
    const col = (name: string): string => row[header.indexOf(name)];

    expect(col('dop'), 'dop should be the ingested number, not empty').to.equal('4.2');
    expect(col('elevation'), 'elevation should be the ingested number, not empty').to.equal('1234.5');
    expect(col('timestamp'), 'timestamp should be the ingested ISO string, not empty').to.not.equal('');
    expect(col('decimalLatitude'), 'decimalLatitude should be extracted from the GeoJSON Point').to.equal('49.5678');
    expect(col('decimalLongitude'), 'decimalLongitude should be extracted from the GeoJSON Point').to.equal(
      '-123.1234'
    );
  });
});
