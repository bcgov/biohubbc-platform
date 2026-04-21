import { cleanup, waitFor } from '@testing-library/react';
import { DownloadRecord } from 'interfaces/useDownloadApi.interface';
import { render } from 'test-helpers/test-utils';
import { DownloadSidebarDownloads } from './DownloadSidebarDownloads';

const mockGetDownloads = vi.fn();

vi.mock('hooks/useApi', () => ({
  useApi: () => ({
    download: {
      getDownloads: mockGetDownloads
    }
  })
}));

const makeDownload = (overrides: Partial<DownloadRecord> = {}): DownloadRecord => ({
  download_id: 'abc-123',
  download_status: 'ready',
  create_date: '2026-03-01T00:00:00Z',
  feature_count: 42,
  total_fragments: 1,
  completed_fragments: 1,
  estimated_total_size_bytes: '1024',
  started_at: '2026-03-01T00:01:00Z',
  completed_at: '2026-03-01T00:02:00Z',
  downloaded_at: null,
  ...overrides
});

describe('DownloadSidebarDownloads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const mockPagination = (overrides = {}) => ({ total: 1, current_page: 1, last_page: 1, ...overrides });

  it('renders download cards when data loads', async () => {
    mockGetDownloads.mockResolvedValue({
      downloads: [makeDownload({ download_id: 'd1' }), makeDownload({ download_id: 'd2' })],
      pagination: mockPagination({ total: 2 })
    });

    const { getAllByText } = render(<DownloadSidebarDownloads />);

    await waitFor(() => {
      expect(getAllByText('Ready').length).toBe(2);
    });
  });

  it('shows empty state when no downloads exist', async () => {
    mockGetDownloads.mockResolvedValue({ downloads: [], pagination: mockPagination({ total: 0 }) });

    const { getByText } = render(<DownloadSidebarDownloads />);

    await waitFor(() => {
      expect(getByText(/no downloads/i)).toBeVisible();
    });
  });

  it('passes pagination params to getDownloads', async () => {
    mockGetDownloads.mockResolvedValue({
      downloads: [makeDownload()],
      pagination: mockPagination()
    });

    render(<DownloadSidebarDownloads />);

    await waitFor(() => {
      expect(mockGetDownloads).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 10 }));
    });
  });

  it('hides pagination when only one page of results', async () => {
    mockGetDownloads.mockResolvedValue({
      downloads: [makeDownload()],
      pagination: mockPagination({ last_page: 1 })
    });

    const { queryByRole } = render(<DownloadSidebarDownloads />);

    await waitFor(() => {
      expect(queryByRole('navigation')).not.toBeInTheDocument();
    });
  });

  it('shows pagination when multiple pages exist', async () => {
    mockGetDownloads.mockResolvedValue({
      downloads: [makeDownload()],
      pagination: mockPagination({ total: 25, last_page: 3 })
    });

    const { getByRole } = render(<DownloadSidebarDownloads />);

    await waitFor(() => {
      expect(getByRole('navigation')).toBeVisible();
    });
  });
});
