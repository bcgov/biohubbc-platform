import { cleanup, fireEvent, waitFor } from '@testing-library/react';
import { makeDownload, makeExport } from 'test-helpers/download-helpers';
import { render } from 'test-helpers/test-utils';
import { DownloadSidebarDownloads, isExportReady, triggerIframeDownload } from './DownloadSidebarDownloads';

const mockGetDownloads = vi.fn();
const mockCreateExport = vi.fn();
const mockGetExport = vi.fn();
const mockSetErrorDialog = vi.fn();

vi.mock('hooks/useApi', () => ({
  useApi: () => ({
    download: { getDownloads: mockGetDownloads },
    downloadExport: { createExport: mockCreateExport, getExport: mockGetExport }
  })
}));

vi.mock('hooks/useContext', () => ({
  useDialogContext: () => ({ setErrorDialog: mockSetErrorDialog })
}));

describe('DownloadSidebarDownloads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    // Clear any leftover iframes between tests to keep assertions about iframe count clean.
    document.querySelectorAll('iframe').forEach((el) => el.remove());
  });

  const mockPagination = (overrides = {}) => ({ total: 1, current_page: 1, last_page: 1, ...overrides });

  describe('isExportReady', () => {
    it.each([
      { status: 'pending', expected: false },
      { status: 'processing', expected: false },
      { status: 'ready', expected: true },
      { status: 'failed', expected: false }
    ] as const)('returns $expected for status "$status"', ({ status, expected }) => {
      expect(isExportReady(status)).toBe(expected);
    });
  });

  describe('list rendering', () => {
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

    it('passes pre-joined exports through to each card', async () => {
      mockGetDownloads.mockResolvedValue({
        downloads: [makeDownload({ download_id: 'd1', exports: [makeExport({ download_version_export_id: 'exp-1' })] })],
        pagination: mockPagination()
      });

      const { findByTestId } = render(<DownloadSidebarDownloads />);

      expect(await findByTestId('export-row-exp-1')).toBeInTheDocument();
    });

    it('refresh button re-fires getDownloads (exports come pre-joined)', async () => {
      mockGetDownloads.mockResolvedValue({
        downloads: [makeDownload()],
        pagination: mockPagination()
      });

      const { getByTitle } = render(<DownloadSidebarDownloads />);

      await waitFor(() => {
        expect(mockGetDownloads).toHaveBeenCalledTimes(1);
      });

      fireEvent.click(getByTitle('Refresh downloads'));

      await waitFor(() => {
        expect(mockGetDownloads).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('handleCreateExport', () => {
    it('calls createExport then refreshes the downloads list', async () => {
      mockGetDownloads.mockResolvedValue({
        downloads: [makeDownload({ download_id: 'abc-123', download_status: 'ready' })],
        pagination: mockPagination()
      });
      mockCreateExport.mockResolvedValue({});

      const { findByTestId } = render(<DownloadSidebarDownloads />);

      const menuButton = await findByTestId('custom-menu-icon-Export');
      fireEvent.click(menuButton);
      fireEvent.click(await findByTestId('custom-menu-icon-item-CSV—perfeaturetype'));

      await waitFor(() => {
        expect(mockCreateExport).toHaveBeenCalledWith('abc-123');
      });
      // Initial load + refresh after create = 2
      await waitFor(() => {
        expect(mockGetDownloads).toHaveBeenCalledTimes(2);
      });
    });

    it('surfaces a dialog with "Export Error" on createExport rejection', async () => {
      mockGetDownloads.mockResolvedValue({
        downloads: [makeDownload({ download_id: 'abc-123', download_status: 'ready' })],
        pagination: mockPagination()
      });
      mockCreateExport.mockRejectedValue(new Error('boom'));

      const { findByTestId } = render(<DownloadSidebarDownloads />);

      fireEvent.click(await findByTestId('custom-menu-icon-Export'));
      fireEvent.click(await findByTestId('custom-menu-icon-item-CSV—perfeaturetype'));

      await waitFor(() => {
        expect(mockSetErrorDialog).toHaveBeenCalledWith(expect.objectContaining({ dialogTitle: 'Export Error' }));
      });
    });
  });

  describe('handleDownloadExportPart', () => {
    it('fetches export detail, finds matching part, and injects an iframe with that URL', async () => {
      mockGetDownloads.mockResolvedValue({
        downloads: [
          makeDownload({
            download_id: 'abc-123',
            download_status: 'ready',
            exports: [makeExport({ download_version_export_id: 'exp-1', status: 'ready', part_count: 1 })]
          })
        ],
        pagination: mockPagination()
      });
      mockGetExport.mockResolvedValue({
        download_version_export_id: 'exp-1',
        parts: [{ chunk_id: 1, file_size_bytes: '1024', url: 'https://s3.example.com/part1' }]
      });

      const { findByTestId } = render(<DownloadSidebarDownloads />);

      fireEvent.click(await findByTestId('export-download-button-exp-1'));

      await waitFor(() => {
        expect(mockGetExport).toHaveBeenCalledWith('abc-123', 'exp-1');
      });

      const iframes = document.querySelectorAll('iframe');
      expect(iframes.length).toBe(1);
      expect(iframes[0].getAttribute('src')).toBe('https://s3.example.com/part1');
    });

    it('surfaces a Download Error dialog on getExport rejection and injects no iframe', async () => {
      mockGetDownloads.mockResolvedValue({
        downloads: [
          makeDownload({
            download_id: 'abc-123',
            download_status: 'ready',
            exports: [makeExport({ download_version_export_id: 'exp-1', status: 'ready', part_count: 1 })]
          })
        ],
        pagination: mockPagination()
      });
      mockGetExport.mockRejectedValue(new Error('boom'));

      const { findByTestId } = render(<DownloadSidebarDownloads />);

      fireEvent.click(await findByTestId('export-download-button-exp-1'));

      await waitFor(() => {
        expect(mockSetErrorDialog).toHaveBeenCalledWith(expect.objectContaining({ dialogTitle: 'Download Error' }));
      });
      expect(document.querySelectorAll('iframe').length).toBe(0);
    });
  });

  describe('handleDownloadExportAllParts', () => {
    it('makes ONE getExport call and injects N iframes in order', async () => {
      mockGetDownloads.mockResolvedValue({
        downloads: [
          makeDownload({
            download_id: 'abc-123',
            download_status: 'ready',
            exports: [makeExport({ download_version_export_id: 'exp-1', status: 'ready', part_count: 3 })]
          })
        ],
        pagination: mockPagination()
      });
      mockGetExport.mockResolvedValue({
        download_version_export_id: 'exp-1',
        parts: [
          { chunk_id: 1, file_size_bytes: '1', url: 'https://s3.example.com/p1' },
          { chunk_id: 2, file_size_bytes: '1', url: 'https://s3.example.com/p2' },
          { chunk_id: 3, file_size_bytes: '1', url: 'https://s3.example.com/p3' }
        ]
      });

      const { findByTestId } = render(<DownloadSidebarDownloads />);

      fireEvent.click(await findByTestId('export-download-all-button-exp-1'));

      await waitFor(() => {
        expect(mockGetExport).toHaveBeenCalledWith('abc-123', 'exp-1');
      });
      expect(mockGetExport).toHaveBeenCalledTimes(1);

      const iframes = document.querySelectorAll('iframe');
      expect(iframes.length).toBe(3);
      expect(iframes[0].getAttribute('src')).toBe('https://s3.example.com/p1');
      expect(iframes[1].getAttribute('src')).toBe('https://s3.example.com/p2');
      expect(iframes[2].getAttribute('src')).toBe('https://s3.example.com/p3');
    });

    it('surfaces a Download Error dialog on getExport rejection and injects no iframes', async () => {
      mockGetDownloads.mockResolvedValue({
        downloads: [
          makeDownload({
            download_id: 'abc-123',
            download_status: 'ready',
            exports: [makeExport({ download_version_export_id: 'exp-1', status: 'ready', part_count: 3 })]
          })
        ],
        pagination: mockPagination()
      });
      mockGetExport.mockRejectedValue(new Error('boom'));

      const { findByTestId } = render(<DownloadSidebarDownloads />);

      fireEvent.click(await findByTestId('export-download-all-button-exp-1'));

      await waitFor(() => {
        expect(mockSetErrorDialog).toHaveBeenCalledWith(expect.objectContaining({ dialogTitle: 'Download Error' }));
      });
      expect(document.querySelectorAll('iframe').length).toBe(0);
    });
  });

  describe('handleRebuildExport (954 stub)', () => {
    it('surfaces a "Nothing to download" dialog when the rebuild button is clicked', async () => {
      mockGetDownloads.mockResolvedValue({
        downloads: [
          makeDownload({
            download_id: 'abc-123',
            download_status: 'ready',
            exports: [makeExport({ download_version_export_id: 'exp-1', status: 'ready', part_count: 0 })]
          })
        ],
        pagination: mockPagination()
      });

      const { findByTestId } = render(<DownloadSidebarDownloads />);

      fireEvent.click(await findByTestId('export-rebuild-button-exp-1'));

      await waitFor(() => {
        expect(mockSetErrorDialog).toHaveBeenCalledWith(
          expect.objectContaining({ dialogTitle: 'Nothing to download' })
        );
      });
    });
  });

  describe('triggerIframeDownload', () => {
    it('removes the injected iframe after 30s', () => {
      vi.useFakeTimers();
      try {
        triggerIframeDownload('https://s3.example.com/test');

        expect(document.querySelectorAll('iframe').length).toBe(1);

        vi.advanceTimersByTime(31000);

        expect(document.querySelectorAll('iframe').length).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
