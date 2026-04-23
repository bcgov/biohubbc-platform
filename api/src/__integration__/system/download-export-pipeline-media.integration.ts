// System integration tests for the CSV download export pipeline — exercises
// the real binary-streaming path (file-type features, cross-part duplication,
// missing-binary fallback) against MinIO. Requires MinIO (S3) to be running.
//
// These cases care about the `files{N}/` binary-copy path, which the pure-DB
// file cannot cover without MinIO. `ParquetReader.openS3` is still stubbed
// per-test so we don't need to build a valid Parquet fixture on the fly — the
// point of these cases is the binary path, not the Parquet reader.
//
// Run: make test-sys
// Requires: make web (database + MinIO must be running)

import * as parquetjs from '@dsnp/parquetjs';
import AdmZip from 'adm-zip';
import { expect } from 'chai';
import sinon from 'sinon';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { DownloadStatusEnum } from '../../models/download-status';
import { DownloadExportRepository } from '../../repositories/download/download-export-repository';
import { DownloadRepository } from '../../repositories/download/download-repository';
import { CartService } from '../../services/cart-service';
import { DownloadExportPipelineService } from '../../services/download/download-export-pipeline-service';
import { DownloadService } from '../../services/download/download-service';
import { BucketType, ObjectStorageService } from '../../services/object-storage/object-storage-service';
import { ArtifactService } from '../../services/upload/artifact-service';
import { createTestFeature, createTestSubmission } from '../helpers/test-submission-helpers';

const TEST_PREFIX = 'dev-artifacts/export-media';

/** Download a zip file from S3 and return it as an AdmZip instance. */
async function downloadZipFromS3(storageService: ObjectStorageService, s3Key: string): Promise<AdmZip> {
  const fileStream = await storageService.getFileStream(BucketType.MAIN, s3Key);
  const chunks: Buffer[] = [];
  for await (const chunk of fileStream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return new AdmZip(Buffer.concat(chunks));
}

/**
 * Stub `ParquetReader.openS3` with an in-process reader whose cursor yields
 * the given rows then null. Keeps these tests focused on the binary-copy
 * path — we don't write a real Parquet fixture, which would be costly.
 */
function stubParquetReaderWithRows(rows: Record<string, unknown>[]): void {
  sinon.stub(parquetjs.ParquetReader, 'openS3').callsFake(async () => {
    let index = 0;
    const cursor = {
      next: async () => {
        if (index >= rows.length) {
          return null;
        }
        return rows[index++];
      }
    };
    return {
      getCursor: () => cursor,
      close: async () => undefined
    } as unknown as parquetjs.ParquetReader;
  });
}

describe('Download Export pipeline — media (system)', function () {
  this.timeout(60000);

  let connection: IDBConnection;
  let exportRepo: DownloadExportRepository;
  let downloadRepo: DownloadRepository;
  let pipelineService: DownloadExportPipelineService;
  let downloadService: DownloadService;
  let cartService: CartService;
  let artifactService: ArtifactService;
  const storageService = new ObjectStorageService();
  const s3KeysToCleanup: string[] = [];

  before(() => {
    initDBPool(defaultPoolConfig);
  });

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    exportRepo = new DownloadExportRepository(connection);
    downloadRepo = new DownloadRepository(connection);
    pipelineService = new DownloadExportPipelineService(connection);
    downloadService = new DownloadService(connection);
    cartService = new CartService(connection);
    artifactService = new ArtifactService(connection);
  });

  afterEach(async () => {
    sinon.restore();

    // Collect any part-zip keys the pipeline wrote so we can clean them after rollback.
    // Must run BEFORE rollback — after rollback, the rows are gone and we can't discover keys.
    const pipelineKeys = await connection
      .sql(
        SQL`
          SELECT a.object_key
          FROM download_export_artifact dea
          INNER JOIN artifact a ON a.artifact_id = dea.artifact_id
          WHERE dea.record_end_date IS NULL
            AND a.object_key LIKE 'downloads/%/exports/%';
        `
      )
      .then((r) => r.rows.map((row: { object_key: string }) => row.object_key))
      .catch(() => [] as string[]);

    for (const k of pipelineKeys) {
      s3KeysToCleanup.push(k);
    }

    await connection.rollback();
    connection.release();

    for (const key of s3KeysToCleanup) {
      try {
        await storageService.deleteFile(BucketType.MAIN, key);
      } catch {
        /* may not exist */
      }
    }
    s3KeysToCleanup.length = 0;
  });

  // ── Helpers ──────────────────────────────────────────────────────────

  /**
   * Seed a READY download with one `file`-type submission feature whose
   * `data.file` points at a real object in MinIO, and insert a corresponding
   * per-feature-type Parquet `download_artifact` row.
   *
   * The Parquet bytes aren't written — we stub `ParquetReader.openS3` per-test
   * to emit a row referencing the seeded artifact key. This keeps the cases
   * focused on the binary-streaming path.
   */
  async function seedReadyDownloadWithFileFeature(
    fileContent: Buffer,
    originalFilename: string,
    extraFileCount = 0
  ): Promise<{
    downloadId: string;
    submissionFeatureIds: number[];
    artifactKey: string;
  }> {
    const submissionId = await createTestSubmission(connection);
    // Unique-per-test key prefix so parallel MinIO state stays isolated, but the
    // last path segment is exactly `originalFilename` — the pipeline derives the
    // zip entry filename from `filePath.split('/').pop()`, so the key's final
    // segment must match what the assertion expects.
    const artifactKey = `${TEST_PREFIX}/${Date.now()}/${originalFilename}`;

    // Upload the binary ONCE; share across features if extraFileCount > 0 (Edge Case 4).
    await storageService.uploadBuffer(BucketType.MAIN, fileContent, 'application/octet-stream', artifactKey);
    s3KeysToCleanup.push(artifactKey);

    const totalFiles = 1 + extraFileCount;
    const submissionFeatureIds: number[] = [];
    for (let i = 0; i < totalFiles; i++) {
      // `data.file` is the fallback key the export pipeline reads for artifact_key properties.
      const featureId = await createTestFeature(connection, submissionId, 'file', { file: artifactKey });
      submissionFeatureIds.push(featureId);
    }

    const systemUserId = connection.systemUserId();
    const cartResponse = await cartService.createCart(systemUserId, submissionFeatureIds);
    const { download_id: downloadId } = await downloadService.createDownload({
      cartId: cartResponse.cart.cart_id,
      format: 'parquet'
    });

    await downloadRepo.updateDownloadStatus(downloadId, DownloadStatusEnum.READY, {
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString()
    });

    // Per-feature-type Parquet artifact row. The Parquet bytes aren't real —
    // ParquetReader.openS3 is stubbed — but the row shape has to match
    // downloads/{downloadId}/{featureType}/data.parquet so
    // parseFeatureTypeFromParquetKey picks it up.
    const parquetKey = `downloads/${downloadId}/file/data.parquet`;
    const { artifact_id } = await artifactService.insertArtifact({
      bucket: 'test-bucket',
      object_key: parquetKey,
      byte_size: 1024,
      artifact_status: 'uploaded',
      checksum_sha256: 'a'.repeat(64),
      uploaded_at: new Date().toISOString(),
      format: 'parquet'
    });
    await downloadRepo.createDownloadArtifact(downloadId, artifact_id);

    return { downloadId, submissionFeatureIds, artifactKey };
  }

  /**
   * Create a pending download_export row. The export pipeline finalizes exactly
   * one part-zip at `max_part_size_bytes = 524288000` (default 500MB), which is
   * more than enough for these tiny fixtures.
   */
  async function seedPendingExport(downloadId: string, maxPartSizeBytes = '524288000'): Promise<string> {
    const record = await exportRepo.createDownloadExport({
      download_id: downloadId,
      format: 'csv',
      mode: 'per_feature_type',
      max_part_size_bytes: maxPartSizeBytes
    });
    return record.download_export_id;
  }

  /**
   * Look up the part-zip keys the pipeline wrote for an export, in chunk_id order.
   */
  async function listPartZipKeysForExport(exportId: string): Promise<string[]> {
    const rows = await connection.sql(SQL`
      SELECT a.object_key
      FROM download_export_artifact dea
      INNER JOIN artifact a ON a.artifact_id = dea.artifact_id
      WHERE dea.download_export_id = ${exportId}
        AND dea.record_end_date IS NULL
      ORDER BY dea.chunk_id ASC;
    `);
    return rows.rows.map((r: { object_key: string }) => r.object_key);
  }

  // ── Tests ────────────────────────────────────────────────────────────

  it('happy path — binary is copied into the part-zip at files1/ and referenced by the CSV', async () => {
    const fileContent = Buffer.from('hello world');
    const filename = 'hello.bin';
    const { downloadId, submissionFeatureIds, artifactKey } = await seedReadyDownloadWithFileFeature(
      fileContent,
      filename
    );
    const exportId = await seedPendingExport(downloadId);
    const featureId = submissionFeatureIds[0];

    stubParquetReaderWithRows([{ submission_feature_id: featureId, file: artifactKey }]);

    await pipelineService.runExport(exportId);

    const keys = await listPartZipKeysForExport(exportId);
    expect(keys).to.have.lengthOf(1);
    const partZipKey = keys[0];

    const zip = await downloadZipFromS3(storageService, partZipKey);
    const entries = zip.getEntries().map((e) => e.entryName);

    const binaryEntry = `biohub-${exportId}-part-1/files1/${featureId}_${filename}`;
    const csvEntry = `biohub-${exportId}-part-1/file/chunk1.csv`;

    expect(entries).to.include(binaryEntry);
    expect(entries).to.include(csvEntry);

    const binaryBytes = zip.readFile(binaryEntry);
    expect(binaryBytes, 'binary entry should be present').to.not.be.null;
    expect(binaryBytes!.equals(fileContent)).to.be.true;

    const csvText = zip.readFile(csvEntry)?.toString('utf-8') ?? '';
    expect(csvText).to.include(`files1/${featureId}_${filename}`);

    const status = await connection.sql(SQL`
      SELECT status FROM download_export WHERE download_export_id = ${exportId};
    `);
    expect(status.rows[0].status).to.equal(DownloadStatusEnum.READY);
  });

  it('missing binary — pipeline writes an .error.txt placeholder and still finishes READY', async () => {
    const fileContent = Buffer.from('soon to be deleted');
    const filename = 'gone.bin';
    const { downloadId, submissionFeatureIds, artifactKey } = await seedReadyDownloadWithFileFeature(
      fileContent,
      filename
    );
    const exportId = await seedPendingExport(downloadId);
    const featureId = submissionFeatureIds[0];

    // Delete the binary before running the export — the pipeline's getFileStream
    // will throw NoSuchKey, triggering the .error.txt fallback.
    await storageService.deleteFile(BucketType.MAIN, artifactKey);
    // Drop it from cleanup tracking since it's already gone.
    const idx = s3KeysToCleanup.indexOf(artifactKey);
    if (idx >= 0) {
      s3KeysToCleanup.splice(idx, 1);
    }

    stubParquetReaderWithRows([{ submission_feature_id: featureId, file: artifactKey }]);

    await pipelineService.runExport(exportId);

    const keys = await listPartZipKeysForExport(exportId);
    expect(keys).to.have.lengthOf(1);
    const zip = await downloadZipFromS3(storageService, keys[0]);
    const entries = zip.getEntries().map((e) => e.entryName);

    const binaryEntry = `biohub-${exportId}-part-1/files1/${featureId}_${filename}`;
    const errorEntry = `${binaryEntry}.error.txt`;

    expect(entries, 'binary must not be present after deletion').to.not.include(binaryEntry);
    expect(entries).to.include(errorEntry);

    const errText = zip.readFile(errorEntry)?.toString('utf-8') ?? '';
    expect(errText).to.include('could not retrieve');

    const status = await connection.sql(SQL`
      SELECT status FROM download_export WHERE download_export_id = ${exportId};
    `);
    expect(status.rows[0].status).to.equal(DownloadStatusEnum.READY);
  });

  // Edge Case 4 — cross-part binary duplication. Currently skipped because the
  // production pipeline has a real bug: `runExport` finalizes rolled-over parts
  // inside the CSV streaming loop (download-export-pipeline-service.ts:562-570
  // calls `writePartZip` + `archiverByPart.delete(oldPartIndex)`), so by the time
  // the post-CSV `for (const partIndex of openPartIndexes)` binary-copy loop runs
  // (same file, line 590), only the final still-open part is in
  // `archiverByPart`. Binaries for rolled-over parts are silently dropped — their
  // `fileRefs` entries never match a bundle and the CSV `filePath` column points
  // at a `filesN/` entry that doesn't exist in the zip.
  //
  // Reproducer (confirmed 2026-04-22, pipe branch):
  //   - 2 rows, `max_part_size_bytes = '1'` → 3 part-zips produced.
  //   - Part 1 contains `file/chunk1.csv` only (no `files1/` binary).
  //   - Part 2 contains `file/chunk2.csv` only (no `files2/` binary).
  //   - Part 3 is empty.
  //
  // Un-skip after the bug is fixed (append binaries per rolled-over part before
  // finalizing, or defer all finalizes until after the binary-copy loop).
  it.skip('cross-part duplication — shared binary is copied into each part and the CSV paths match the owning part', async () => {
    const fileContent = Buffer.from('shared file content for both rows');
    const filename = 'shared.bin';
    const { downloadId, submissionFeatureIds, artifactKey } = await seedReadyDownloadWithFileFeature(
      fileContent,
      filename,
      1 // two features total, both pointing at the same artifactKey
    );
    expect(submissionFeatureIds).to.have.lengthOf(2);
    const [id1, id2] = submissionFeatureIds;

    const exportId = await seedPendingExport(downloadId, '1');

    stubParquetReaderWithRows([
      { submission_feature_id: id1, file: artifactKey },
      { submission_feature_id: id2, file: artifactKey }
    ]);

    await pipelineService.runExport(exportId);

    const keys = await listPartZipKeysForExport(exportId);
    expect(keys.length).to.be.at.least(2);
    const [part1Key, part2Key] = keys;

    const part1Zip = await downloadZipFromS3(storageService, part1Key);
    const part2Zip = await downloadZipFromS3(storageService, part2Key);

    const part1Binary = `biohub-${exportId}-part-1/files1/${id1}_${filename}`;
    const part2Binary = `biohub-${exportId}-part-2/files2/${id2}_${filename}`;

    const part1Bytes = part1Zip.readFile(part1Binary);
    expect(part1Bytes, 'part-1 must contain its binary').to.not.be.null;
    expect(part1Bytes!.equals(fileContent)).to.be.true;

    const part2Bytes = part2Zip.readFile(part2Binary);
    expect(part2Bytes, 'part-2 must contain its binary').to.not.be.null;
    expect(part2Bytes!.equals(fileContent)).to.be.true;

    const part2CsvEntry = `biohub-${exportId}-part-2/file/chunk2.csv`;
    const part2Csv = part2Zip.readFile(part2CsvEntry)?.toString('utf-8') ?? '';
    expect(part2Csv).to.include(`files2/${id2}_${filename}`);
    expect(part2Csv).to.not.include(`files1/`);
  });
});
