import { expect } from 'chai';
import { randomUUID } from 'node:crypto';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { ApiConflictError, ApiNotFoundError } from '../../errors/api-error';
import { SummaryMetric } from '../../models/summary-metric';
import { SummaryMetricDataService } from '../../services/summary-metric-data-service';
import { SummaryMetricService } from '../../services/summary-metric-service';

// Real schema, constraints, audit triggers, and JSON storage; every fixture is rolled back.
describe('Summary metric CRUD and latest values (integration)', function () {
  this.timeout(15000);
  let connection: IDBConnection;
  let metricService: SummaryMetricService;
  let dataService: SummaryMetricDataService;
  let metric: SummaryMetric;

  before(() => initDBPool(defaultPoolConfig));
  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    metricService = new SummaryMetricService(connection);
    dataService = new SummaryMetricDataService(connection);
    metric = await metricService.createSummaryMetric({
      key: `integration_${randomUUID().replaceAll('-', '')}`,
      name: 'Integration metric',
      description: 'Test metric'
    });
  });
  afterEach(async () => {
    await connection.rollback();
    connection.release();
  });

  async function createValue(value: unknown, calculated_at = '2020-01-01T00:00:00Z', run_id: string = randomUUID()) {
    return dataService.createSummaryMetricData({
      summary_metric_id: metric.summary_metric_id,
      run_id,
      calculated_at,
      value
    });
  }

  it('creates, lists, reads, and updates definitions while retaining immutable keys', async () => {
    expect(await metricService.getSummaryMetric(metric.summary_metric_id)).to.deep.equal(metric);
    const updated = await metricService.updateSummaryMetric(metric.summary_metric_id, {
      name: 'Updated',
      description: 'New description'
    });
    expect(updated.key).to.equal(metric.key);
    expect(updated.name).to.equal('Updated');
    expect(await metricService.getSummaryMetricsCount({ search: metric.key })).to.equal(1);
    expect(await metricService.getSummaryMetrics({ search: metric.key }, { page: 1, limit: 1 })).to.deep.equal([
      updated
    ]);
    expect(await metricService.getSummaryMetrics({ search: metric.key }, { page: 2, limit: 1 })).to.deep.equal([]);
  });

  for (const value of [42, '2020-12-31', null, false, { total: 9 }, [1, 'two']]) {
    it(`stores and reads JSON ${JSON.stringify(value)} without changing its type`, async () => {
      const created = await createValue(value);
      expect(created.value).to.deep.equal(value);
      expect((await dataService.getSummaryMetricData(created.summary_metrics_data_id)).value).to.deep.equal(value);
      const updated = await dataService.updateSummaryMetricData(created.summary_metrics_data_id, {
        value: { corrected: true }
      });
      expect(updated.value).to.deep.equal({ corrected: true });
      expect(updated.summary_metric_id).to.equal(created.summary_metric_id);
      expect(updated.run_id).to.equal(created.run_id);
      expect(updated.calculated_at).to.equal(created.calculated_at);
      const latest = (await dataService.getLatestSummaryMetricsData()).find(
        (row) => row.summary_metric_id === metric.summary_metric_id
      );
      expect(latest?.value).to.deep.equal({ corrected: true });
    });
  }

  it('filters and paginates historical values by metric and calculation run', async () => {
    const first = await createValue(1);
    await createValue(2);
    const filters = { summary_metric_id: metric.summary_metric_id, run_id: first.run_id };
    expect(await dataService.getSummaryMetricsDataCount(filters)).to.equal(1);
    expect(await dataService.getSummaryMetricsData(filters, { page: 1, limit: 1 })).to.deep.equal([first]);
    expect(await dataService.getSummaryMetricsData(filters, { page: 2, limit: 1 })).to.deep.equal([]);
    expect(await dataService.getSummaryMetricsDataCount({ summary_metric_id: metric.summary_metric_id })).to.equal(2);
  });

  it('selects the latest value per metric and breaks equal calculation times by ID', async () => {
    await createValue('old', '2019-01-01T00:00:00Z');
    const first = await createValue('first');
    const second = await createValue(null);
    await createValue('future', '9999-01-01T00:00:00Z');
    let latest = (await dataService.getLatestSummaryMetricsData()).find(
      (row) => row.summary_metric_id === metric.summary_metric_id
    );
    expect(latest?.summary_metrics_data_id).to.equal(second.summary_metrics_data_id);
    expect(latest?.value).to.equal(null);
    expect(latest?.key).to.equal(metric.key);
    await dataService.deleteSummaryMetricData(second.summary_metrics_data_id);
    latest = (await dataService.getLatestSummaryMetricsData()).find(
      (row) => row.summary_metric_id === metric.summary_metric_id
    );
    expect(latest?.summary_metrics_data_id).to.equal(first.summary_metrics_data_id);
    const ended = await connection.sql(SQL`
      SELECT record_end_date FROM summary_metrics_data WHERE summary_metrics_data_id = ${second.summary_metrics_data_id};
    `);
    expect(ended.rows[0].record_end_date).not.to.equal(null);
    expect(await dataService.getSummaryMetricsDataCount({ summary_metric_id: metric.summary_metric_id })).to.equal(3);
  });

  it('omits metrics with no values or only future-effective values', async () => {
    expect(
      (await dataService.getLatestSummaryMetricsData()).some(
        (row) => row.summary_metric_id === metric.summary_metric_id
      )
    ).to.equal(false);
    const data = await createValue(1);
    await connection.sql(SQL`
      UPDATE summary_metrics_data SET record_effective_date = now() + interval '1 day'
      WHERE summary_metrics_data_id = ${data.summary_metrics_data_id};
    `);
    expect(
      (await dataService.getLatestSummaryMetricsData()).some(
        (row) => row.summary_metric_id === metric.summary_metric_id
      )
    ).to.equal(false);
  });

  it('retires a referenced definition without deleting historical values or reusing its key', async () => {
    const data = await createValue(10);
    await metricService.deleteSummaryMetric(metric.summary_metric_id);
    expect(await dataService.getSummaryMetricData(data.summary_metrics_data_id)).to.deep.equal(data);
    expect(await metricService.getSummaryMetricsCount({ search: metric.key })).to.equal(0);
    expect(
      (await dataService.getLatestSummaryMetricsData()).some(
        (row) => row.summary_metric_id === metric.summary_metric_id
      )
    ).to.equal(false);
    let missing: unknown;
    try {
      await createValue(20);
    } catch (error) {
      missing = error;
    }
    expect(missing).to.be.instanceOf(ApiNotFoundError);
    let duplicate: unknown;
    try {
      await metricService.createSummaryMetric({ key: metric.key, name: 'Reused', description: '' });
    } catch (error) {
      duplicate = error;
    }
    expect(duplicate).to.be.instanceOf(ApiConflictError);
    const historical = await connection.sql(SQL`
      SELECT count(*)::int AS count FROM summary_metrics_data WHERE summary_metric_id = ${metric.summary_metric_id};
    `);
    expect(historical.rows[0].count).to.equal(1);
  });

  it('rejects duplicate dictionary keys and duplicate metric/run pairs', async () => {
    let duplicate: unknown;
    try {
      await metricService.createSummaryMetric({ key: metric.key, name: 'Duplicate', description: '' });
    } catch (error) {
      duplicate = error;
    }
    expect(duplicate).to.be.instanceOf(ApiConflictError);
    const data = await createValue(1);
    let duplicateRun: unknown;
    try {
      await createValue(2, '2020-01-01T00:00:00Z', data.run_id);
    } catch (error) {
      duplicateRun = error;
    }
    expect(duplicateRun).to.be.instanceOf(ApiConflictError);
  });

  it('returns not found for missing or retired records', async () => {
    const data = await createValue(1);
    await dataService.deleteSummaryMetricData(data.summary_metrics_data_id);
    let missing: unknown;
    try {
      await dataService.getSummaryMetricData(data.summary_metrics_data_id);
    } catch (error) {
      missing = error;
    }
    expect(missing).to.be.instanceOf(ApiNotFoundError);
    await metricService.deleteSummaryMetric(metric.summary_metric_id);
    let retired: unknown;
    try {
      await metricService.getSummaryMetric(metric.summary_metric_id);
    } catch (error) {
      retired = error;
    }
    expect(retired).to.be.instanceOf(ApiNotFoundError);
  });
});
