/**
 * Produce a parquet file set you can inspect.
 *
 * Mirrors the happy-path of
 *   biohubbc-platform/api/src/__integration__/system/download-system.integration.ts
 *     → 'should process a parquet download job and upload per-type files to S3'
 *
 * but skips all cleanup so the rows + S3 objects survive the run, and copies the
 * parquet files out of MinIO onto the host filesystem for inspection.
 *
 * Canonical location: docs/scripts/inspect-parquet-download.ts (outside the api
 * repo). Imports are relative to biohubbc-platform/api/src/scripts/ — copy this
 * file into the api source tree to run it (the sibling docs/scripts/ files
 * follow the same convention):
 *
 *   mkdir -p biohubbc-platform/api/src/scripts
 *   cp docs/scripts/inspect-parquet-download.ts biohubbc-platform/api/src/scripts/
 *   (cd biohubbc-platform && make web && make queue && make minio)
 *   (cd biohubbc-platform && docker compose exec api npx ts-node --files src/scripts/inspect-parquet-download.ts)
 *
 * Output (host-visible, since ./api is bind-mounted at /opt/app-root/src):
 *   biohubbc-platform/api/tmp/parquet-inspection/run-<downloadId>/
 *     dataset.parquet
 *     sample_site.parquet
 *     file.parquet
 *     summary.json
 *
 * Note on data fidelity: the download pipeline's `hydrateFeatureBatch` reads
 * property values from typed tables (`submission_feature_property_string`,
 * `_geometry`, `_number`, `_timestamp`, `_boolean`) — NOT from
 * `submission_feature.data`. The ingestion pipeline never writes to those typed
 * tables (only seeds/04_mock_test_data.ts does). So to get non-NULL columns out
 * of the writer, this script populates the typed tables directly, matching what
 * the seed script does. `array`, `object`, and `artifact_key` properties go
 * through the JSONB fallback path and read from `data.properties`.
 */

import { knex } from 'knex';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getOrCreateTestTicketId } from '../__integration__/helpers/test-ticket-helpers';
import { initPgBoss, stopPgBoss } from '../queue/pg-boss-service';
import { BucketType, ObjectStorageService } from '../services/object-storage/object-storage-service';

const TEST_PREFIX = 'dev-artifacts';
const SYSTEM_USER_ID = 1;
const OUTPUT_ROOT = resolve(process.cwd(), 'tmp/parquet-inspection');

async function main() {
  const db = knex({
    client: 'pg',
    connection: {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      database: process.env.DB_DATABASE,
      user: process.env.DB_USER_API,
      password: process.env.DB_USER_API_PASS
    },
    searchPath: ['biohub', 'public']
  });

  const storage = new ObjectStorageService();
  await initPgBoss();

  try {
    // 1. Submission
    const [submissionRow] = await db('biohub.submission')
      .insert({
        uuid: db.raw('gen_random_uuid()'),
        system_user_id: SYSTEM_USER_ID,
        contributor_id: 1,
        name: `${TEST_PREFIX} Parquet Inspection`,
        description: 'Produced by scripts/inspect-parquet-download.ts',
        comment: 'inspect-parquet-download',
        create_user: SYSTEM_USER_ID
      })
      .returning('submission_id');
    const submissionId: number = submissionRow.submission_id;

    // 2. Three features covering all three axes the parquet writer cares about:
    //    dataset         - spatial (geometry in data, but no spatial-typed property → no geo footer)
    //    sample_site     - spatial (geometry is feature_property_type_name='spatial' → geo footer)
    //    file            - non-spatial, carries an artifact_key column
    const datasetFeatureId = await insertFeature(db, submissionId, 'dataset', {
      properties: {
        name: 'Inspection Dataset',
        description: 'Produced by inspect-parquet-download.ts',
        start_date: '2024-01-01T00:00:00.000Z',
        end_date: '2024-12-31T00:00:00.000Z'
      }
    });

    const sampleSiteFeatureId = await insertFeature(
      db,
      submissionId,
      'sample_site',
      {
        properties: {
          name: 'Inspection Site',
          description: 'Produced by inspect-parquet-download.ts',
          geometry: { type: 'Point', coordinates: [-130.849, 56.207] }
        }
      },
      datasetFeatureId
    );

    // Seed an S3-backed artifact so the file feature's artifact_key column round-trips
    const artifactSourceKey = `${TEST_PREFIX}/parquet-inspection-file-${Date.now()}.bin`;
    const artifactSourceBytes = Buffer.from('inspection-source-file-content');
    await storage.uploadBuffer(BucketType.MAIN, artifactSourceBytes, 'application/octet-stream', artifactSourceKey);

    const bucketName = process.env.OBJECT_STORE_BUCKET_NAME!;
    await db('biohub.artifact').insert({
      bucket: bucketName,
      object_key: artifactSourceKey,
      byte_size: artifactSourceBytes.length,
      artifact_status: 'uploaded',
      uploaded_at: new Date().toISOString(),
      format: 'tar',
      create_user: SYSTEM_USER_ID
    });

    const fileFeatureId = await insertFeature(
      db,
      submissionId,
      'file',
      { properties: { artifact_key: artifactSourceKey, filename: 'inspection.bin' } },
      datasetFeatureId
    );

    // 3. Cart + cart_submission_feature
    const [cartRow] = await db('biohub.cart')
      .insert({ system_user_id: SYSTEM_USER_ID, cart_status: 'checked_out', create_user: SYSTEM_USER_ID })
      .returning('cart_id');
    const cartId: string = cartRow.cart_id;

    await db('biohub.cart_submission_feature').insert(
      [datasetFeatureId, sampleSiteFeatureId, fileFeatureId].map((id) => ({
        cart_id: cartId,
        submission_feature_id: id,
        create_user: SYSTEM_USER_ID
      }))
    );

    // 4. Download (parquet) + publish job
    const [downloadRow] = await db('biohub.download')
      .insert({
        download_status: 'pending',
        cart_id: cartId,
        format: 'parquet',
        create_user: SYSTEM_USER_ID
      })
      .returning('download_id');
    const downloadId: number = downloadRow.download_id;

    console.log(`[inspect-parquet] submission_id=${submissionId} download_id=${downloadId} cart_id=${cartId}`);

    const boss = await initPgBoss();
    await boss.createQueue('process-download');
    const jobId = await boss.send('process-download', { downloadId, teamId: null });
    console.log(`[inspect-parquet] published job ${jobId} — waiting for worker…`);

    await waitForDownloadStatus(db, downloadId, 'ready', 90_000);

    // 5. Copy parquet files out of MinIO
    const outputDir = resolve(OUTPUT_ROOT, `run-${downloadId}`);
    await mkdir(outputDir, { recursive: true });

    const s3List = await storage.listFiles(BucketType.MAIN, `downloads/${downloadId}/`);
    const keys = (s3List.Contents ?? []).map((o) => o.Key!).sort();

    const artifactRows = await db('biohub.artifact')
      .join('biohub.download_artifact', 'biohub.download_artifact.artifact_id', 'biohub.artifact.artifact_id')
      .where('biohub.download_artifact.download_id', downloadId)
      .whereNull('biohub.download_artifact.record_end_date')
      .select(
        'biohub.artifact.artifact_id',
        'biohub.artifact.object_key',
        'biohub.artifact.byte_size',
        'biohub.artifact.checksum_sha256'
      );
    const artifactByKey = new Map(artifactRows.map((r: any) => [r.object_key, r]));

    const files: Array<{
      s3Key: string;
      localPath: string;
      byteSize: number;
      sha256: string;
      sha256Matches: boolean;
      artifactId?: string;
    }> = [];

    for (const s3Key of keys) {
      const buf = await readS3ToBuffer(storage, s3Key);
      // featureType is the last path segment before /data.parquet
      const featureType = s3Key.split('/').slice(-2, -1)[0];
      const localPath = resolve(outputDir, `${featureType}.parquet`);
      await writeFile(localPath, buf);

      const sha256 = createHash('sha256').update(buf).digest('hex');
      const row = artifactByKey.get(s3Key);
      files.push({
        s3Key,
        localPath,
        byteSize: buf.length,
        sha256,
        sha256Matches: row ? sha256 === row.checksum_sha256 : false,
        artifactId: row?.artifact_id
      });
    }

    const [finalDownload] = await db('biohub.download').where('download_id', downloadId).select('*');

    const summary = {
      downloadId,
      submissionId,
      cartId,
      featureIds: {
        dataset: datasetFeatureId,
        sample_site: sampleSiteFeatureId,
        file: fileFeatureId
      },
      artifactSourceKey,
      downloadStatus: finalDownload.download_status,
      completedAt: finalDownload.completed_at,
      files
    };

    await writeFile(resolve(outputDir, 'summary.json'), JSON.stringify(summary, null, 2));

    console.log(`[inspect-parquet] wrote ${files.length} parquet file(s) to ${outputDir}`);
    for (const f of files) {
      console.log(`  - ${f.localPath} (${f.byteSize} bytes, sha256 ${f.sha256Matches ? '✓' : '✗'})`);
    }
    console.log('[inspect-parquet] summary.json written alongside the parquet files');
    console.log('');
    console.log('Inspect with duckdb (example):');
    console.log(`  duckdb -c "SELECT * FROM read_parquet('${outputDir}/sample_site.parquet');"`);
    console.log(`  duckdb -c "SELECT * FROM parquet_metadata('${outputDir}/sample_site.parquet');"`);
    console.log('');
    console.log('DB / S3 rows left in place so you can re-query. To clean up:');
    console.log(`  DELETE FROM biohub.download_artifact WHERE download_id = ${downloadId};`);
    console.log(`  DELETE FROM biohub.artifact WHERE artifact_id IN (...);  -- see summary.json`);
    console.log(`  DELETE FROM biohub.download WHERE download_id = ${downloadId};`);
    console.log(`  DELETE FROM biohub.cart WHERE cart_id = '${cartId}';`);
  } finally {
    await stopPgBoss();
    await db.destroy();
  }
}

async function insertFeature(
  db: ReturnType<typeof knex>,
  submissionId: number,
  featureTypeName: string,
  data: Record<string, unknown>,
  parentFeatureId?: number
): Promise<number> {
  const featureType = await db('biohub.feature_type').where('name', featureTypeName).first();
  if (!featureType) {
    throw new Error(`Feature type '${featureTypeName}' not found in seed data`);
  }

  const dataJson = JSON.stringify(data);

  const [upload] = await db('biohub.upload')
    .insert({ upload_status: 'completed', record_end_date: db.fn.now(), create_user: SYSTEM_USER_ID })
    .returning('upload_id');
  const ticketId = await getOrCreateTestTicketId(db as any, submissionId, upload.upload_id, SYSTEM_USER_ID);

  const [bridge] = await db('biohub.submission_upload')
    .insert({
      submission_id: submissionId,
      upload_id: upload.upload_id,
      ticket_id: ticketId,
      create_user: SYSTEM_USER_ID
    })
    .returning('submission_upload_id');

  await db('biohub.submission_upload_status').insert({
    submission_upload_id: bridge.submission_upload_id,
    status: 'approved',
    create_user: SYSTEM_USER_ID
  });

  const [row] = await db('biohub.submission_feature')
    .insert({
      submission_id: submissionId,
      feature_type_id: featureType.feature_type_id,
      parent_submission_feature_id: parentFeatureId ?? null,
      data: dataJson,
      data_byte_size: db.raw(`octet_length(?::jsonb::text) + 500`, [dataJson]),
      submission_upload_id: bridge.submission_upload_id,
      create_user: SYSTEM_USER_ID
    })
    .returning('submission_feature_id');
  const submissionFeatureId: number = row.submission_feature_id;

  await populateTypedProperties(db, submissionFeatureId, featureType.feature_type_id, data);

  return submissionFeatureId;
}

/**
 * Write one row per non-JSONB property into the matching typed table.
 * Mirrors what seeds/04_mock_test_data.ts does — required because the download
 * pipeline reads typed property values from these tables, not from `data`, and
 * nothing in the ingestion pipeline populates them.
 * Skips array / object / artifact_key (JSONB fallback) and code / taxon (need FK
 * rows we're not exercising here).
 */
async function populateTypedProperties(
  db: ReturnType<typeof knex>,
  submissionFeatureId: number,
  featureTypeId: number,
  data: Record<string, unknown>
): Promise<void> {
  const propertyRows = await db('biohub.feature_type_property as ftp')
    .join('biohub.feature_property as fp', 'fp.feature_property_id', 'ftp.feature_property_id')
    .join('biohub.feature_property_type as fpt', 'fpt.feature_property_type_id', 'fp.feature_property_type_id')
    .where('ftp.feature_type_id', featureTypeId)
    .whereNull('ftp.record_end_date')
    .whereNull('fp.record_end_date')
    .select<Array<{ feature_type_property_id: number; name: string; type_name: string }>>(
      'ftp.feature_type_property_id',
      'fp.name',
      'fpt.name as type_name'
    );

  // Real ingestion stores property values under `data.properties.<name>`
  const properties = (data.properties ?? {}) as Record<string, unknown>;

  for (const prop of propertyRows) {
    const value = properties[prop.name];
    if (value === undefined || value === null) {
      continue;
    }

    switch (prop.type_name) {
      case 'string':
        await db('biohub.submission_feature_property_string').insert({
          submission_feature_id: submissionFeatureId,
          feature_type_property_id: prop.feature_type_property_id,
          value: typeof value === 'string' ? value : JSON.stringify(value),
          create_user: SYSTEM_USER_ID
        });
        break;
      case 'number':
        await db('biohub.submission_feature_property_number').insert({
          submission_feature_id: submissionFeatureId,
          feature_type_property_id: prop.feature_type_property_id,
          value: Number(value),
          create_user: SYSTEM_USER_ID
        });
        break;
      case 'boolean':
        await db('biohub.submission_feature_property_boolean').insert({
          submission_feature_id: submissionFeatureId,
          feature_type_property_id: prop.feature_type_property_id,
          value: Boolean(value),
          create_user: SYSTEM_USER_ID
        });
        break;
      case 'datetime':
        await db('biohub.submission_feature_property_timestamp').insert({
          submission_feature_id: submissionFeatureId,
          feature_type_property_id: prop.feature_type_property_id,
          value: new Date(value as string).toISOString(),
          create_user: SYSTEM_USER_ID
        });
        break;
      case 'spatial':
        await db('biohub.submission_feature_property_geometry').insert({
          submission_feature_id: submissionFeatureId,
          feature_type_property_id: prop.feature_type_property_id,
          value: db.raw('public.ST_GeomFromGeoJSON(?)', [JSON.stringify(value)]),
          create_user: SYSTEM_USER_ID
        });
        break;
      default:
        break;
    }
  }
}

async function waitForDownloadStatus(
  db: ReturnType<typeof knex>,
  downloadId: number,
  targetStatus: string,
  timeoutMs: number
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const [row] = await db('biohub.download').where('download_id', downloadId).select('download_status', 'metadata');
    if (row?.download_status === targetStatus) {
      return;
    }
    if (row?.download_status === 'failed') {
      throw new Error(`Download ${downloadId} failed: ${JSON.stringify(row.metadata)}`);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timeout waiting for download ${downloadId} to reach '${targetStatus}'`);
}

async function readS3ToBuffer(storage: ObjectStorageService, key: string): Promise<Buffer> {
  const stream = await storage.getFileStream(BucketType.MAIN, key);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

try {
  await main();
} catch (error) {
  console.error('[inspect-parquet] failed:', error);
  process.exit(1);
}
