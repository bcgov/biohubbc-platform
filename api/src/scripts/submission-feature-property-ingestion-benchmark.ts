import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../database/db';
import { SubmissionFeaturePropertyIngestionService } from '../services/ingestion/submission-feature-property-ingestion-service';

type Args = {
  submissionId: number;
  submissionUploadId: string;
  iterations: number;
  seedTemplateUploadId?: string;
  seedRowCount?: number;
  clearTargetFeatures: boolean;
};

function parseArgs(argv: string[]): Args {
  const getValue = (flag: string): string | undefined => {
    const index = argv.findIndex((arg) => arg === flag);
    if (index === -1 || index + 1 >= argv.length) {
      return undefined;
    }
    return argv[index + 1];
  };

  const hasFlag = (flag: string): boolean => argv.includes(flag);

  const submissionId = Number(getValue('--submission-id'));
  const submissionUploadId = getValue('--submission-upload-id');
  const iterations = Number(getValue('--iterations') ?? '1');
  const seedTemplateUploadId = getValue('--seed-template-upload-id');
  const seedRowCount = getValue('--seed-row-count') ? Number(getValue('--seed-row-count')) : undefined;
  const clearTargetFeatures = hasFlag('--clear-target-features');

  if (!Number.isInteger(submissionId) || submissionId <= 0) {
    throw new Error('Missing or invalid --submission-id (positive integer required)');
  }

  if (!submissionUploadId) {
    throw new Error('Missing --submission-upload-id');
  }

  if (!Number.isInteger(iterations) || iterations <= 0) {
    throw new Error('Invalid --iterations (positive integer required)');
  }

  if ((seedTemplateUploadId && !seedRowCount) || (!seedTemplateUploadId && seedRowCount)) {
    throw new Error('Both --seed-template-upload-id and --seed-row-count are required for synthetic seeding');
  }

  if (seedRowCount !== undefined && (!Number.isInteger(seedRowCount) || seedRowCount <= 0)) {
    throw new Error('Invalid --seed-row-count (positive integer required)');
  }

  return {
    submissionId,
    submissionUploadId,
    iterations,
    seedTemplateUploadId,
    seedRowCount,
    clearTargetFeatures
  };
}

async function maybeClearTargetFeatures(connection: IDBConnection, submissionUploadId: string): Promise<void> {
  const sql = SQL`
    DELETE FROM submission_feature
    WHERE submission_upload_id = ${submissionUploadId}::uuid;
  `;
  await connection.sql(sql);
}

async function seedSyntheticFeaturesFromTemplate(
  connection: IDBConnection,
  submissionId: number,
  submissionUploadId: string,
  templateUploadId: string,
  rowCount: number
): Promise<number> {
  const sql = SQL`
    WITH template AS (
      SELECT
        sf.feature_type_id,
        (sf.data - 'parent' - 'references') AS data
      FROM submission_feature sf
      WHERE sf.submission_upload_id = ${templateUploadId}::uuid
        AND sf.record_end_date IS NULL
      ORDER BY sf.submission_feature_id ASC
      LIMIT 1
    ),
    generated AS (
      INSERT INTO submission_feature (
        submission_id,
        submission_upload_id,
        parent_submission_feature_id,
        source_id,
        feature_type_id,
        data,
        record_effective_date
      )
      SELECT
        ${submissionId},
        ${submissionUploadId}::uuid,
        NULL,
        ('bench-source-' || gs.idx::text),
        template.feature_type_id,
        template.data,
        NOW()
      FROM template
      CROSS JOIN generate_series(1, ${rowCount}) AS gs(idx)
      RETURNING submission_feature_id
    )
    SELECT COUNT(*)::integer AS inserted_count
    FROM generated;
  `;

  const response = await connection.sql<{ inserted_count: number }>(sql);
  return response.rows[0]?.inserted_count ?? 0;
}

async function getUploadMetrics(
  connection: IDBConnection,
  submissionUploadId: string
): Promise<{
  featureCount: number;
  stagingCount: number;
  errorCount: number;
}> {
  const featureCountSql = SQL`
    SELECT COUNT(*)::integer AS count
    FROM submission_feature
    WHERE submission_upload_id = ${submissionUploadId}::uuid
      AND record_end_date IS NULL;
  `;
  const stagingCountSql = SQL`
    SELECT COUNT(*)::integer AS count
    FROM submission_feature_property_staging
    WHERE submission_upload_id = ${submissionUploadId}::uuid;
  `;
  const errorCountSql = SQL`
    SELECT COUNT(*)::integer AS count
    FROM submission_feature_ingestion_error
    WHERE submission_upload_id = ${submissionUploadId}::uuid;
  `;

  const [featureResponse, stagingResponse, errorResponse] = await Promise.all([
    connection.sql<{ count: number }>(featureCountSql),
    connection.sql<{ count: number }>(stagingCountSql),
    connection.sql<{ count: number }>(errorCountSql)
  ]);

  return {
    featureCount: featureResponse.rows[0]?.count ?? 0,
    stagingCount: stagingResponse.rows[0]?.count ?? 0,
    errorCount: errorResponse.rows[0]?.count ?? 0
  };
}

async function run(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  initDBPool(defaultPoolConfig);

  const connection = getAPIUserDBConnection();
  try {
    await connection.open();

    if (args.clearTargetFeatures) {
      await maybeClearTargetFeatures(connection, args.submissionUploadId);
    }

    if (args.seedTemplateUploadId && args.seedRowCount) {
      const insertedCount = await seedSyntheticFeaturesFromTemplate(
        connection,
        args.submissionId,
        args.submissionUploadId,
        args.seedTemplateUploadId,
        args.seedRowCount
      );
      console.log(
        JSON.stringify({
          stage: 'seed',
          submissionUploadId: args.submissionUploadId,
          insertedCount
        })
      );
    }

    const service = new SubmissionFeaturePropertyIngestionService(connection);
    const durationsMs: number[] = [];

    for (let i = 0; i < args.iterations; i += 1) {
      const start = process.hrtime.bigint();
      let iterationError: Error | null = null;

      try {
        await service.indexSubmissionPropertiesBySubmissionUploadId(args.submissionId, args.submissionUploadId);
      } catch (error) {
        iterationError = error as Error;
      }

      const elapsedNs = Number(process.hrtime.bigint() - start);
      const elapsedMs = elapsedNs / 1_000_000;
      durationsMs.push(elapsedMs);
      const metrics = await getUploadMetrics(connection, args.submissionUploadId);

      console.log(
        JSON.stringify({
          stage: 'iteration',
          iteration: i + 1,
          durationMs: elapsedMs,
          submissionUploadId: args.submissionUploadId,
          featureCount: metrics.featureCount,
          stagingCount: metrics.stagingCount,
          errorCount: metrics.errorCount,
          failed: Boolean(iterationError),
          errorMessage: iterationError?.message ?? null
        })
      );
    }

    const totalDurationMs = durationsMs.reduce((sum, value) => sum + value, 0);
    const avgDurationMs = totalDurationMs / durationsMs.length;

    console.log(
      JSON.stringify({
        stage: 'summary',
        submissionId: args.submissionId,
        submissionUploadId: args.submissionUploadId,
        iterations: args.iterations,
        totalDurationMs,
        averageDurationMs: avgDurationMs,
        minDurationMs: Math.min(...durationsMs),
        maxDurationMs: Math.max(...durationsMs)
      })
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
