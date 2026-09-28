import { randomUUID } from 'node:crypto';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { ExpressionTree } from '../../models/expression-tree';
import { SecurityRuleRepository } from '../../repositories/security-rule-repository';
import { ExpressionTreeService } from '../../services/expression-tree-service';
import { SearchFeatureService } from '../../services/search-feature-service';
import { SubmissionUploadSecurityService } from '../../services/submission-upload-security-service';
import { allOf, predicate } from '../helpers/test-expression-helpers';
import { createAssignedFeatureProperty, createTestUpload } from '../helpers/test-feature-property-helpers';
import { createTestSubmission } from '../helpers/test-submission-helpers';

// Times upload expression evaluation (review count and page) and automatic screening on telemetry-shaped pending
// uploads. Run on demand against a disposable database with `npm run test:bench`; set BENCHMARK_SIZES to a comma
// separated list of approximate feature counts. Every fixture is rolled back.

const DEPLOYMENT_COUNT = 100;
const SPECIES_RULE_COUNT = 44;
const REGION_POLYGON = {
  type: 'Polygon',
  coordinates: [
    [
      [-125, 49],
      [-120, 49],
      [-120, 52],
      [-125, 52],
      [-125, 49]
    ]
  ]
};

/** Properties of a benchmark upload, by the role each plays in the scenarios. */
interface BenchmarkFixture {
  submissionId: number;
  submissionUploadId: string;
  featureCount: number;
  properties: { region: number; species: number; location: number; count: number };
}

/**
 * Build a pending telemetry upload: one survey in the region, `DEPLOYMENT_COUNT` deployments (ten carrying a
 * screened species, the rest moose), telemetry points split evenly under them with half inside the region polygon,
 * and twenty observations whose counts alternate between 77 and 100.
 *
 * @param {IDBConnection} connection Open connection.
 * @param {number} approximateFeatureCount Target number of features.
 * @returns {Promise<BenchmarkFixture>} Upload and property ids.
 */
async function buildTelemetryUpload(
  connection: IDBConnection,
  approximateFeatureCount: number
): Promise<BenchmarkFixture> {
  const submissionId = await createTestSubmission(connection);
  const submissionUploadId = await createTestUpload(connection, submissionId);
  const region = await createAssignedFeatureProperty(connection, 'string', ['survey']);
  const species = await createAssignedFeatureProperty(connection, 'string', ['telemetry_deployment']);
  const location = await createAssignedFeatureProperty(connection, 'spatial', ['telemetry']);
  const count = await createAssignedFeatureProperty(connection, 'number', ['species_observation']);
  const pointsPerDeployment = Math.max(1, Math.round(approximateFeatureCount / DEPLOYMENT_COUNT));

  const survey = await connection.sql(SQL`
    INSERT INTO submission_feature (submission_id, submission_upload_id, feature_type_id, data, data_byte_size, record_effective_date)
    VALUES (${submissionId}, ${submissionUploadId}::uuid, (SELECT feature_type_id FROM feature_type WHERE name = 'survey'), '{}'::jsonb, 2, NULL)
    RETURNING submission_feature_id;
  `);
  const surveyId = survey.rows[0].submission_feature_id;
  await connection.sql(SQL`
    INSERT INTO submission_feature_property_string (submission_feature_id, blueprint_feature_type_property_id, value)
    VALUES (${surveyId}, ${region.assignments.survey}, 'north')
  `);
  const deployments = await connection.sql(SQL`
    INSERT INTO submission_feature (submission_id, submission_upload_id, feature_type_id, parent_submission_feature_id, data, data_byte_size, record_effective_date)
    SELECT ${submissionId}, ${submissionUploadId}::uuid, (SELECT feature_type_id FROM feature_type WHERE name = 'telemetry_deployment'), ${surveyId}, '{}'::jsonb, 2, NULL
    FROM generate_series(1, ${DEPLOYMENT_COUNT})
    RETURNING submission_feature_id;
  `);
  const deploymentIds: number[] = deployments.rows.map((row) => row.submission_feature_id);
  await connection.sql(SQL`
    INSERT INTO submission_feature_property_string (submission_feature_id, blueprint_feature_type_property_id, value)
    SELECT deployment_id, ${species.assignments.telemetry_deployment},
      CASE WHEN ordinality <= 10 THEN 'species_' || (ordinality - 1) ELSE 'moose' END
    FROM unnest(${deploymentIds}::integer[]) WITH ORDINALITY AS deployment(deployment_id, ordinality)
  `);
  await connection.sql(SQL`
    INSERT INTO submission_feature (submission_id, submission_upload_id, feature_type_id, parent_submission_feature_id, data, data_byte_size, record_effective_date)
    SELECT ${submissionId}, ${submissionUploadId}::uuid, (SELECT feature_type_id FROM feature_type WHERE name = 'telemetry'), deployment_id, '{}'::jsonb, 2, NULL
    FROM unnest(${deploymentIds}::integer[]) AS deployment_id CROSS JOIN generate_series(1, ${pointsPerDeployment})
  `);
  await connection.sql(SQL`
    INSERT INTO submission_feature_property_geometry (submission_feature_id, blueprint_feature_type_property_id, value)
    SELECT point.submission_feature_id, ${location.assignments.telemetry},
      ST_SetSRID(ST_MakePoint(CASE WHEN point.submission_feature_id % 2 = 0 THEN -122 ELSE -110 END, 50), 4326)
    FROM submission_feature point
    WHERE point.submission_upload_id = ${submissionUploadId}::uuid
      AND point.feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'telemetry')
  `);
  const observations = await connection.sql(SQL`
    INSERT INTO submission_feature (submission_id, submission_upload_id, feature_type_id, parent_submission_feature_id, data, data_byte_size, record_effective_date)
    SELECT ${submissionId}, ${submissionUploadId}::uuid, (SELECT feature_type_id FROM feature_type WHERE name = 'species_observation'), ${surveyId}, '{}'::jsonb, 2, NULL
    FROM generate_series(1, 20)
    RETURNING submission_feature_id;
  `);
  const observationIds: number[] = observations.rows.map((row) => row.submission_feature_id);
  await connection.sql(SQL`
    INSERT INTO submission_feature_property_number (submission_feature_id, blueprint_feature_type_property_id, value)
    SELECT observation_id, ${count.assignments.species_observation}, CASE WHEN ordinality % 2 = 0 THEN 77 ELSE 100 END
    FROM unnest(${observationIds}::integer[]) WITH ORDINALITY AS observation(observation_id, ordinality)
  `);

  return {
    submissionId,
    submissionUploadId,
    featureCount: 1 + DEPLOYMENT_COUNT * (1 + pointsPerDeployment) + observationIds.length,
    properties: {
      region: region.featurePropertyId,
      species: species.featurePropertyId,
      location: location.featurePropertyId,
      count: count.featurePropertyId
    }
  };
}

/**
 * Replace the active rule set with the benchmark's rules: one per screened species, plus a dense geometry rule, a
 * survey-level region rule, a cross-type AND and an AND of equalities.
 *
 * @param {IDBConnection} connection Open connection.
 * @param {BenchmarkFixture} fixture Upload whose properties the rules read.
 * @returns {Promise<number>} Number of rules created.
 */
async function createScreeningRules(connection: IDBConnection, fixture: BenchmarkFixture): Promise<number> {
  const { properties } = fixture;
  await connection.sql(SQL`UPDATE security_rule SET is_active = false WHERE is_active`);
  const category = await connection.sql(
    SQL`SELECT security_category_id FROM security_category WHERE record_end_date IS NULL ORDER BY security_category_id LIMIT 1`
  );
  const expressions: ExpressionTree[] = [
    ...Array.from({ length: SPECIES_RULE_COUNT }, (_, index) =>
      allOf(predicate(properties.species, 'Equals', `species_${index}`))
    ),
    allOf(predicate(properties.location, 'Intersects', REGION_POLYGON)),
    allOf(predicate(properties.region, 'Equals', 'north')),
    allOf(predicate(properties.region, 'Equals', 'north'), predicate(properties.species, 'Equals', 'species_0')),
    allOf(predicate(properties.count, 'Equals', 77), predicate(properties.count, 'Equals', 100))
  ];

  for (const expression of expressions) {
    const rule = await new SecurityRuleRepository(connection).insertSecurityRule({
      name: `Benchmark ${randomUUID()}`,
      description: 'Benchmark rule',
      security_category_id: category.rows[0].security_category_id,
      is_active: true
    });
    const { expression_id } = await new ExpressionTreeService(connection).writeExpressionTree(expression);
    await connection.sql(SQL`
      INSERT INTO security_rule_expression (security_rule_id, expression_id)
      VALUES (${rule.security_rule_id}, ${expression_id}::uuid)
    `);
  }

  return expressions.length;
}

/**
 * Time an asynchronous operation.
 *
 * @param {() => Promise<T>} operation Operation to time.
 * @returns {Promise<{ result: T; seconds: number }>} Result and elapsed seconds.
 */
async function time<T>(operation: () => Promise<T>): Promise<{ result: T; seconds: number }> {
  const started = process.hrtime.bigint();
  const result = await operation();
  return { result, seconds: Number(process.hrtime.bigint() - started) / 1e9 };
}

describe('Submission upload expression evaluation benchmark', function () {
  this.timeout(0);

  before(() => initDBPool(defaultPoolConfig));

  for (const size of (process.env.BENCHMARK_SIZES ?? '1000,100000,1000000').split(',').map(Number)) {
    it(`evaluates and screens a telemetry upload of about ${size} features`, async () => {
      const connection = getAPIUserDBConnection();
      await connection.open();
      try {
        const build = await time(() => buildTelemetryUpload(connection, size));
        const fixture = build.result;
        const search = new SearchFeatureService(connection);
        const scenarios: Record<string, ExpressionTree> = {
          'sparse species': allOf(predicate(fixture.properties.species, 'Equals', 'species_0')),
          'dense geometry': allOf(predicate(fixture.properties.location, 'Intersects', REGION_POLYGON)),
          'survey region': allOf(predicate(fixture.properties.region, 'Equals', 'north'))
        };
        const review: Record<string, { matches: number; countSeconds: number; pageSeconds: number }> = {};
        for (const [name, expression] of Object.entries(scenarios)) {
          const counted = await time(() =>
            search.countSubmissionUploadFeatures(fixture.submissionId, fixture.submissionUploadId, { expression })
          );
          const paged = await time(() =>
            search.searchSubmissionUploadFeatures(
              fixture.submissionId,
              fixture.submissionUploadId,
              { expression },
              { limit: 50, sort: 'submission_feature_id', order: 'asc' }
            )
          );
          review[name] = { matches: counted.result, countSeconds: counted.seconds, pageSeconds: paged.seconds };
        }

        const ruleCount = await createScreeningRules(connection, fixture);
        const screening = await time(() =>
          new SubmissionUploadSecurityService(connection).screenSubmissionUpload(
            fixture.submissionUploadId,
            fixture.submissionId,
            null
          )
        );
        const event = await connection.sql(SQL`
          SELECT metadata FROM submission_upload_security WHERE submission_upload_id = ${fixture.submissionUploadId}::uuid
        `);

        console.log(
          JSON.stringify({
            features: fixture.featureCount,
            buildSeconds: build.seconds,
            review,
            screening: { rules: ruleCount, seconds: screening.seconds, metadata: event.rows[0].metadata }
          })
        );
      } finally {
        await connection.rollback();
        connection.release();
      }
    });
  }
});
