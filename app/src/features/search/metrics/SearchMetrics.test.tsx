import { cleanup, waitFor } from '@testing-library/react';
import { LatestSummaryMetric } from 'interfaces/useSummaryMetricsApi.interface';
import { createTestQueryClient } from 'test-helpers/query-client';
import { render } from 'test-helpers/test-utils';
import { summaryMetricQueryKeys } from 'utils/query-keys/summary-metric-query-keys';
import { SearchMetrics } from './SearchMetrics';

const mockGetLatestSummaryMetrics = vi.fn();
vi.mock('hooks/useApi', () => ({
  useApi: () => ({ summaryMetrics: { getLatestSummaryMetrics: mockGetLatestSummaryMetrics } })
}));

const makeMetric = (overrides: Partial<LatestSummaryMetric> = {}): LatestSummaryMetric => ({
  summary_metrics_data_id: '1',
  summary_metric_id: 1,
  run_id: 'run-1',
  calculated_at: '2026-11-04T00:00:00Z',
  value: 10108,
  key: 'record_count',
  name: 'Record count',
  description: 'Number of published records',
  ...overrides
});

describe('SearchMetrics', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it('fetches on mount and displays only the selected metrics in the configured order', async () => {
    mockGetLatestSummaryMetrics.mockResolvedValue({
      summary_metrics_data: [
        makeMetric(),
        makeMetric({ summary_metric_id: 2, key: 'earliest_date', name: 'Earliest date', value: '2015-01-01' }),
        makeMetric({ summary_metric_id: 3, key: 'survey_count', name: 'Survey count', value: 38 }),
        makeMetric({ summary_metric_id: 4, key: 'submission_count', name: 'Submission count', value: 99 }),
        makeMetric({ summary_metric_id: 5, key: 'latest_date', name: 'Latest date', value: '2027-10-31' }),
        makeMetric({ summary_metric_id: 6, key: 'future_metric', name: 'A new metric', value: 42 })
      ]
    });
    const { findByRole, getByText, getAllByRole, queryByText } = render(<SearchMetrics />);
    expect(await findByRole('region', { name: 'Biodiversity data at a glance' })).toBeVisible();
    expect(mockGetLatestSummaryMetrics).toHaveBeenCalledWith({ signal: expect.any(AbortSignal) });
    expect(getByText('Records')).toBeVisible();
    expect(getByText('10,108')).toBeVisible();
    expect(getByText('Jan 1, 2015')).toBeVisible();
    expect(getByText('Surveys')).toBeVisible();
    expect(getByText('38')).toBeVisible();
    expect(getAllByRole('term').map((item) => item.textContent)).toEqual(['Earliest data', 'Surveys', 'Records']);
    expect(queryByText('Submission count')).not.toBeInTheDocument();
    expect(queryByText('Latest date')).not.toBeInTheDocument();
    expect(queryByText('A new metric')).not.toBeInTheDocument();
  });

  it('preserves a zero count and uses a dash for an unknown value', async () => {
    mockGetLatestSummaryMetrics.mockResolvedValue({
      summary_metrics_data: [
        makeMetric({ value: 0 }),
        makeMetric({ summary_metric_id: 2, key: 'earliest_date', name: 'Earliest date', value: null })
      ]
    });
    const { findByText, getByText } = render(<SearchMetrics />);
    expect(await findByText('0')).toBeVisible();
    expect(getByText('Earliest data')).toBeVisible();
    expect(getByText('—')).toBeVisible();
  });

  it('renders booleans and plain strings while omitting structured values', async () => {
    mockGetLatestSummaryMetrics.mockResolvedValue({
      summary_metrics_data: [
        makeMetric({ value: false }),
        makeMetric({ summary_metric_id: 2, key: 'survey_count', name: 'Status', value: 'Available' }),
        makeMetric({ summary_metric_id: 3, key: 'earliest_date', name: 'Structured metric', value: { total: 1 } })
      ]
    });
    const { findByText, getByText, queryByText } = render(<SearchMetrics />);
    expect(await findByText('No')).toBeVisible();
    expect(getByText('Available')).toBeVisible();
    expect(queryByText('Structured metric')).not.toBeInTheDocument();
    expect(queryByText('[object Object]')).not.toBeInTheDocument();
  });

  it('renders nothing while the first request is pending', () => {
    mockGetLatestSummaryMetrics.mockReturnValue(new Promise(() => {}));
    expect(render(<SearchMetrics />).container).toBeEmptyDOMElement();
  });

  it('renders nothing when the API returns no metrics', async () => {
    mockGetLatestSummaryMetrics.mockResolvedValue({ summary_metrics_data: [] });
    const queryClient = createTestQueryClient();
    const { container } = render(<SearchMetrics />, { queryClient });
    await waitFor(() => expect(queryClient.getQueryState(summaryMetricQueryKeys.latest())?.status).toBe('success'));
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing on an API error without blocking the rest of the search page', async () => {
    mockGetLatestSummaryMetrics.mockRejectedValue(new Error('Metrics unavailable'));
    const queryClient = createTestQueryClient();
    const { container } = render(<SearchMetrics />, { queryClient });
    await waitFor(() => expect(queryClient.getQueryState(summaryMetricQueryKeys.latest())?.status).toBe('error'));
    expect(container).toBeEmptyDOMElement();
  });
});
