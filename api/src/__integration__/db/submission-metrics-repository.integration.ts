// Uses the migrated schema and shared fixtures; every test rolls back its transaction.
import { expect } from 'chai';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { SubmissionMetricsRepository } from '../../repositories/submission-metrics-repository';
import { createTestFeature, createTestSubmission } from '../helpers/test-submission-helpers';

describe('SubmissionMetricsRepository (integration)', function () {
  this.timeout(15000);
  let connection: IDBConnection;
  let repository: SubmissionMetricsRepository;

  before(() => initDBPool(defaultPoolConfig));
  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    repository = new SubmissionMetricsRepository(connection);
  });
  afterEach(async () => {
    await connection.rollback();
    connection.release();
  });

  it('counts eligible features once, excludes stale and unpublished rows, and retains snapshots', async () => {
    const baselineRun = await repository.calculateMetrics();
    const baseline = await getValues(baselineRun);
    const submissionId = await createTestSubmission(connection);
    const survey = await createTestFeature(connection, submissionId, 'survey', {});
    const observation = await createTestFeature(connection, submissionId, 'species_observation', {}, survey);
    const pending = await createTestFeature(connection, submissionId, 'survey', {});
    const ended = await createTestFeature(connection, submissionId, 'survey', {});
    const superseded = await createTestFeature(connection, submissionId, 'survey', {});
    const future = await createTestFeature(connection, submissionId, 'survey', {});
    // A current feature without a self row is excluded until its closure is ready.
    await createTestFeature(connection, submissionId, 'survey', {});

    await connection.sql(SQL`
      UPDATE submission_feature SET record_effective_date = NULL WHERE submission_feature_id = ${pending};
    `);
    await connection.sql(SQL`
      UPDATE submission_feature SET record_end_date = now() WHERE submission_feature_id = ${ended};
    `);
    await connection.sql(SQL`
      UPDATE submission_feature SET successor_submission_feature_id = ${survey}
      WHERE submission_feature_id = ${superseded};
    `);
    await connection.sql(SQL`
      UPDATE submission_feature SET record_effective_date = now() + interval '1 day'
      WHERE submission_feature_id = ${future};
    `);
    await connection.sql(SQL`
      INSERT INTO submission_feature_closure (source_submission_feature_id, target_submission_feature_id, is_ancestor)
      SELECT id, id, true FROM unnest(${[survey, observation, pending, ended, superseded, future]}::int[]) AS id
      UNION ALL SELECT ${observation}, ${survey}, true;
    `);

    const firstRun = await repository.calculateMetrics();
    expect(await getValues(firstRun)).to.deep.equal({
      ...baseline,
      record_count: Number(baseline.record_count) + 2,
      submission_count: Number(baseline.submission_count) + 1,
      survey_count: Number(baseline.survey_count) + 1
    });

    // Remove only this fixture's closure slice; existing seed data is untouched.
    await connection.sql(SQL`
      DELETE FROM submission_feature_closure WHERE source_submission_feature_id = ANY(
        ${[survey, observation, pending, ended, superseded, future]}::int[]
      );
    `);
    const secondRun = await repository.calculateMetrics();
    expect(secondRun).not.to.equal(firstRun);
    expect(await getValues(secondRun)).to.deep.equal(baseline);
    const history = await connection.sql(SQL`
      SELECT count(*)::int AS count FROM summary_metrics_data WHERE run_id = ANY(${[firstRun, secondRun]}::uuid[]);
    `);
    expect(history.rows[0].count).to.equal(10);
    const times = await connection.sql(SQL`
      SELECT count(DISTINCT calculated_at)::int AS count FROM summary_metrics_data WHERE run_id = ${firstRun};
    `);
    expect(times.rows[0].count).to.equal(1);
  });

  it('uses indexed submitted dates only for eligible features', async () => {
    const baseline = await getValues(await repository.calculateMetrics());
    const submissionId = await createTestSubmission(connection);
    const survey = await createTestFeature(connection, submissionId, 'survey', {});
    await connection.sql(SQL`
      INSERT INTO submission_feature_property_timestamp
        (submission_feature_id, blueprint_feature_type_property_id, date_value)
      SELECT ${survey}, assignment.blueprint_feature_type_property_id, dates.value::date
      FROM submission_feature sf
      JOIN submission_upload upload USING (submission_upload_id)
      JOIN blueprint_feature_type bft ON bft.blueprint_id = upload.blueprint_id AND bft.feature_type_id = sf.feature_type_id
      JOIN blueprint_feature_type_property assignment USING (blueprint_feature_type_id)
      JOIN feature_property property USING (feature_property_id)
      JOIN feature_property_type type USING (feature_property_type_id)
      CROSS JOIN (VALUES ('0001-01-01'), ('9999-12-31')) AS dates(value)
      WHERE sf.submission_feature_id = ${survey} AND type.name = 'datetime';
    `);
    expect(await getValues(await repository.calculateMetrics())).to.deep.equal(baseline);

    await connection.sql(SQL`
      INSERT INTO submission_feature_closure (source_submission_feature_id, target_submission_feature_id, is_ancestor)
      VALUES (${survey}, ${survey}, true);
    `);
    const values = await getValues(await repository.calculateMetrics());
    expect(values.earliest_date).to.equal('0001-01-01');
    expect(values.latest_date).to.equal('9999-12-31');
  });

  it('supports additional dictionary entries without changing the value table', async () => {
    await connection.sql(SQL`
      INSERT INTO summary_metrics (key, name, description)
      VALUES ('integration_future_metric', 'Future metric', 'A future calculation');
    `);
    expect(Object.keys(await getValues(await repository.calculateMetrics()))).to.have.length(5);
  });

  it('skips retired definitions without failing the remaining calculations', async () => {
    await connection.sql(SQL`
      UPDATE summary_metrics SET record_end_date = now() WHERE key = 'survey_count';
    `);
    const values = await getValues(await repository.calculateMetrics());
    expect(values).not.to.have.property('survey_count');
    expect(values).to.have.property('record_count');
    expect(Object.keys(values)).to.have.length(4);
  });

  it('allows every definition to be retired without creating values or failing the job', async () => {
    await connection.sql(SQL`UPDATE summary_metrics SET record_end_date = now();`);
    expect(await getValues(await repository.calculateMetrics())).to.deep.equal({});
  });

  async function getValues(runId: string): Promise<Record<string, unknown>> {
    const rows = await repository.getMetricsByRunId(runId);
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  }
});
