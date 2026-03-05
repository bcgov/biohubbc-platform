import { cleanup, fireEvent, waitFor } from '@testing-library/react';
import { DownloadRecord } from 'interfaces/useDownloadApi.interface';
import { render } from 'test-helpers/test-utils';
import { DownloadSidebarDownloads, isDownloadReady } from './DownloadSidebarDownloads';

const mockGetDownloads = vi.fn();
const mockGetFragmentUrl = vi.fn();

vi.mock('hooks/useApi', () => ({
  useApi: () => ({
    download: {
      getDownloads: mockGetDownloads,
      getFragmentUrl: mockGetFragmentUrl
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

describe('isDownloadReady', () => {
  it.each([
    { status: 'ready', expected: true },
    { status: 'downloaded', expected: true },
    { status: 'pending', expected: false },
    { status: 'processing', expected: false },
    { status: 'failed', expected: false },
    { status: 'unknown', expected: false }
  ])('returns $expected for "$status"', ({ status, expected }) => {
    expect(isDownloadReady(status)).toBe(expected);
  });
});

describe('DownloadSidebarDownloads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders download cards when data loads', async () => {
    mockGetDownloads.mockResolvedValue({
      downloads: [makeDownload({ download_id: 'd1' }), makeDownload({ download_id: 'd2' })]
    });

    const { getAllByTestId } = render(<DownloadSidebarDownloads />);

    await waitFor(() => {
      expect(getAllByTestId('download-button')).toHaveLength(2);
    });
  });

  it('shows empty state when no downloads exist', async () => {
    mockGetDownloads.mockResolvedValue({ downloads: [] });

    const { getByText } = render(<DownloadSidebarDownloads />);

    await waitFor(() => {
      expect(getByText(/no downloads/i)).toBeVisible();
    });
  });

  it('calls getFragmentUrl and opens URL on download click', async () => {
    mockGetDownloads.mockResolvedValue({
      downloads: [makeDownload({ download_id: 'dl-1' })]
    });
    mockGetFragmentUrl.mockResolvedValue({ url: 'https://s3.example.com/signed' });
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    const { getByTestId } = render(<DownloadSidebarDownloads />);

    await waitFor(() => {
      expect(getByTestId('download-button')).toBeVisible();
    });

    fireEvent.click(getByTestId('download-button'));

    await waitFor(() => {
      expect(mockGetFragmentUrl).toHaveBeenCalledWith('dl-1', 0);
      expect(openSpy).toHaveBeenCalledWith('https://s3.example.com/signed', '_blank', 'noopener,noreferrer');
    });

    openSpy.mockRestore();
  });
});
