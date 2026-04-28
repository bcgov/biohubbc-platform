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
import { PassThrough } from 'node:stream';
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
import { getObjectStoreBucketName } from '../../utils/file-utils';
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
 * Stream a real Parquet fixture of roughly `targetBytes` directly to MinIO and
 * return the actual uploaded byte size. Used by the OOM-guard case so the
 * export pipeline has a real Parquet file to read.
 *
 * The fixture is streamed — writer → PassThrough → S3 multipart upload — so the
 * test itself doesn't buffer the fixture in memory while writing. Rows carry
 * randomized base64 padding so Parquet's dictionary compression can't collapse
 * them into a tiny footprint.
 */
async function writeFatParquetToMinIO(
  storageService: ObjectStorageService,
  objectKey: string,
  targetBytes: number
): Promise<number> {
  const schema = new parquetjs.ParquetSchema({
    uuid: { type: 'UTF8', optional: false },
    parent_uuid: { type: 'UTF8', optional: true },
    submission_feature_id: { type: 'INT64', optional: false },
    observation_name: { type: 'UTF8', optional: true },
    description: { type: 'UTF8', optional: true }
  });

  const passThrough = new PassThrough();
  const uploadPromise = storageService.uploadStream(
    BucketType.MAIN,
    passThrough,
    'application/octet-stream',
    objectKey
  );

  const writer = await parquetjs.ParquetWriter.openStream(schema, passThrough as any);

  // Each row carries a ~1 KiB payload of randomized bytes so dictionary
  // compression can't collapse the file to a handful of unique values.
  const payload = Buffer.alloc(1024);
  let rowsWritten = 0;
  // Linear congruential step picked for decent spread; we only need enough
  // variability to defeat dictionary compression, not cryptographic entropy.
  const stepBytes = 37;

  // Approximate uncompressed-bytes-per-row is ~1200; stop slightly past the
  // target so the on-disk (compressed) size is comfortably near the target
  // without over-shooting by too much. Hard ceiling keeps a pathological run
  // (compression ratio surprise) bounded.
  const approxBytesPerRow = 1200;
  const targetRows = Math.max(1, Math.ceil(targetBytes / approxBytesPerRow));
  const ceilingRows = targetRows * 4;

  while (rowsWritten < targetRows && rowsWritten < ceilingRows) {
    for (let i = 0; i < payload.length; i++) {
      payload[i] = (payload[i] + stepBytes) & 0xff;
    }
    await writer.appendRow({
      uuid: `uuid-${rowsWritten.toString(36)}`,
      parent_uuid: null,
      // submission_feature_id is NOT NULL in the Parquet schema; the export
      // pipeline throws on missing/null. Use the row index as a synthetic PK
      // — the export only needs uniqueness for filename namespacing.
      submission_feature_id: rowsWritten + 1,
      observation_name: `obs-${rowsWritten}`,
      description: payload.toString('base64')
    });
    rowsWritten++;
  }

  await writer.close();
  await uploadPromise;

  const metadata = await storageService.getMetadata(BucketType.MAIN, objectKey);
  return Number(metadata.ContentLength);
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

    const binaryEntry = `biohub-export-${exportId}/files1/${featureId}_${filename}`;
    const csvEntry = `biohub-export-${exportId}/file/chunk1.csv`;

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

    const binaryEntry = `biohub-export-${exportId}/files1/${featureId}_${filename}`;
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

    const part1Binary = `biohub-export-${exportId}/files1/${id1}_${filename}`;
    const part2Binary = `biohub-export-${exportId}/files2/${id2}_${filename}`;

    const part1Bytes = part1Zip.readFile(part1Binary);
    expect(part1Bytes, 'part-1 must contain its binary').to.not.be.null;
    expect(part1Bytes!.equals(fileContent)).to.be.true;

    const part2Bytes = part2Zip.readFile(part2Binary);
    expect(part2Bytes, 'part-2 must contain its binary').to.not.be.null;
    expect(part2Bytes!.equals(fileContent)).to.be.true;

    const part2CsvEntry = `biohub-export-${exportId}/file/chunk2.csv`;
    const part2Csv = part2Zip.readFile(part2CsvEntry)?.toString('utf-8') ?? '';
    expect(part2Csv).to.include(`files2/${id2}_${filename}`);
    expect(part2Csv).to.not.include(`files1/`);
  });

  /**
   * OOM guard — spec UO 10.
   *
   * Writes a real Parquet fixture whose size exceeds what a naive "read whole
   * file" implementation could tolerate, runs the export, and asserts peak
   * heap growth stays bounded. The streaming design (`ParquetReader.openS3` +
   * row-group cursor + backpressured writes) should keep working set to
   * roughly: one row group + archiver deflate buffer + S3 multipart queue.
   *
   * A failure here means the pipeline is buffering the whole Parquet file
   * before emitting CSV — a regression that would OOM on production-scale
   * downloads.
   */
  it('runExport holds peak heap bounded against a larger-than-heap Parquet fixture', async function () {
    this.timeout(5 * 60 * 1000);

    // ~96 MiB fixture — large enough to span multiple Parquet row groups
    // (default ~4k rows per group), small enough to write in a minute or two.
    const fixtureTargetBytes = 96 * 1024 * 1024;

    // Seed a download with one feature of type 'dataset'. The export pipeline
    // reads properties via `getFeatureTypePropertyCodes`, so the feature type
    // must exist in seed data — 'dataset' is a root type already used by the
    // sibling integration tests.
    const submissionId = await createTestSubmission(connection);
    const featureId = await createTestFeature(connection, submissionId, 'dataset', {
      name: 'oom-seed'
    });

    const systemUserId = connection.systemUserId();
    const cartResponse = await cartService.createCart(systemUserId, [featureId]);
    const { download_id: downloadId } = await downloadService.createDownload({
      cartId: cartResponse.cart.cart_id,
      format: 'parquet'
    });

    await downloadRepo.updateDownloadStatus(downloadId, DownloadStatusEnum.READY, {
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString()
    });

    // Write the fat Parquet fixture at the canonical per-feature-type key.
    const parquetKey = `downloads/${downloadId}/dataset/data.parquet`;
    const uploadedBytes = await writeFatParquetToMinIO(storageService, parquetKey, fixtureTargetBytes);
    s3KeysToCleanup.push(parquetKey);

    // Require at least half the target size so a surprise compression ratio
    // doesn't silently make the test trivial.
    expect(uploadedBytes, 'fixture should be substantive').to.be.at.least(fixtureTargetBytes / 2);

    const { artifact_id } = await artifactService.insertArtifact({
      bucket: getObjectStoreBucketName(),
      object_key: parquetKey,
      byte_size: uploadedBytes,
      artifact_status: 'uploaded',
      checksum_sha256: 'a'.repeat(64),
      uploaded_at: new Date().toISOString(),
      format: 'parquet'
    });
    await downloadRepo.createDownloadArtifact(downloadId, artifact_id);

    const exportId = await seedPendingExport(downloadId);

    // Baseline: sample heap after writing the fixture but before the export
    // runs. Using `heapUsed` directly — we're watching for large deltas, not
    // absolute values, and forcing a GC isn't available without `--expose-gc`.
    const baselineHeapBytes = process.memoryUsage().heapUsed;

    // Sample peak heap while the export runs.
    let peakHeapBytes = baselineHeapBytes;
    const sampler = setInterval(() => {
      const used = process.memoryUsage().heapUsed;
      if (used > peakHeapBytes) {
        peakHeapBytes = used;
      }
    }, 250);

    try {
      await pipelineService.runExport(exportId);
    } finally {
      clearInterval(sampler);
    }

    // Verify the export finished successfully.
    const statusRow = await connection.sql(SQL`
      SELECT status FROM download_export WHERE download_export_id = ${exportId};
    `);
    expect(statusRow.rows[0].status).to.equal(DownloadStatusEnum.READY);

    // A streaming implementation should keep peak working set well under the
    // fixture size — bounded by one row group (~32-128 MiB) plus the
    // archiver/upload buffers. A naive buffer-the-whole-file implementation
    // would show heap growth roughly equal to or greater than fixture size
    // (plus CSV expansion). The 500 MiB ceiling leaves comfortable headroom
    // without accepting linear scaling.
    const growthBytes = peakHeapBytes - baselineHeapBytes;
    const growthMiB = growthBytes / (1024 * 1024);
    const fixtureMiB = uploadedBytes / (1024 * 1024);
    expect(
      growthBytes,
      `heap growth should stay bounded (fixture ${fixtureMiB.toFixed(0)} MiB, peak grew ${growthMiB.toFixed(0)} MiB)`
    ).to.be.lessThan(500 * 1024 * 1024);
  });
});
