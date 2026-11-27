import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { LatestSummaryMetricsResponse } from 'interfaces/useSummaryMetricsApi.interface';
import { useSummaryMetricsApi } from './useSummaryMetricsApi';

describe('useSummaryMetricsApi', () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(axios);
  });
  afterEach(() => mock.restore());

  it('fetches the public latest metrics endpoint and preserves the response types', async () => {
    const response: LatestSummaryMetricsResponse = {
      summary_metrics_data: [
        {
          summary_metrics_data_id: '1',
          summary_metric_id: 1,
          run_id: 'run-1',
          calculated_at: '2026-11-04T00:00:00Z',
          value: 1234,
          key: 'record_count',
          name: 'Records',
          description: 'Published records'
        }
      ]
    };
    mock.onGet('/api/summary-metrics-data/latest').reply(200, response);
    const signal = new AbortController().signal;

    expect(await useSummaryMetricsApi(axios).getLatestSummaryMetrics({ signal })).toEqual(response);
    expect(mock.history.get).toHaveLength(1);
    expect(mock.history.get[0].signal).toBe(signal);
  });

  it('returns an empty metric list before data has been calculated', async () => {
    mock.onGet('/api/summary-metrics-data/latest').reply(200, { summary_metrics_data: [] });
    expect(await useSummaryMetricsApi(axios).getLatestSummaryMetrics()).toEqual({ summary_metrics_data: [] });
  });

  it('propagates API errors to the query', async () => {
    mock.onGet('/api/summary-metrics-data/latest').reply(500);
    await expect(useSummaryMetricsApi(axios).getLatestSummaryMetrics()).rejects.toThrow();
  });
});
