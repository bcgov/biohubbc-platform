import { cleanup, fireEvent, waitFor } from '@testing-library/react';
import { APIError } from 'hooks/api/useAxios';
import { DownloadFeatureType } from 'interfaces/useDownloadExportApi.interface';
import { makeDownload, makeExport } from 'test-helpers/download-helpers';
import { render } from 'test-helpers/test-utils';
import { DownloadSidebarDownloads } from './DownloadSidebarDownloads';
import { isExportReady, triggerIframeDownload } from './download-export-utils';

const mockGetDownloads = vi.fn();
const mockCreateExport = vi.fn();
const mockGetExport = vi.fn();
const mockGetDownloadFeatureTypes = vi.fn();
const mockSetErrorDialog = vi.fn();
const mockSetSnackbar = vi.fn();

// Typed fixture for the download's materialized feature types. Drives the config dialog's picker and
// the all-types recipe the one-click path builds (it maps these to `feature_type` names).
const mockFeatureTypes: DownloadFeatureType[] = [
  { feature_type: 'telemetry', columns: ['uuid', 'parent_uuid', 'vendor'] },
  { feature_type: 'deployment', columns: ['uuid', 'parent_uuid', 'device_id'] }
];

vi.mock('hooks/useApi', () => ({
  useApi: () => ({
    download: { getDownloads: mockGetDownloads },
    downloadExport: {
      createExport: mockCreateExport,
      getExport: mockGetExport,
      getDownloadFeatureTypes: mockGetDownloadFeatureTypes
    }
  })
}));

vi.mock('hooks/useContext', () => ({
  useDialogContext: () => ({ setErrorDialog: mockSetErrorDialog, setSnackbar: mockSetSnackbar })
}));

describe('DownloadSidebarDownloads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Most tests need the download's feature types resolved; per-test overrides may reject/replace.
    mockGetDownloadFeatureTypes.mockResolvedValue(mockFeatureTypes);
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
        downloads: [
          makeDownload({ download_id: 'd1', exports: [makeExport({ download_version_export_id: 'exp-1' })] })
        ],
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
    it('fetches feature types, posts an all-types per-feature-type recipe, then refreshes the list', async () => {
      // Verifies: the one-click path now builds the recipe client-side — it fetches the download's
      // feature types and POSTs a per_feature_type config enumerating every type (not an empty body).

      // Step 1: A ready download to export, and a successful createExport.
      mockGetDownloads.mockResolvedValue({
        downloads: [makeDownload({ download_id: 'abc-123', download_status: 'ready' })],
        pagination: mockPagination()
      });
      mockCreateExport.mockResolvedValue({});

      const { findByTestId } = render(<DownloadSidebarDownloads />);

      // Step 2: Open the Export menu and pick the one-click "CSV — per feature type" item.
      const menuButton = await findByTestId('custom-menu-icon-Export');
      fireEvent.click(menuButton);
      fireEvent.click(await findByTestId('custom-menu-icon-item-CSV—perfeaturetype'));

      // Step 3: Feature types are fetched for THIS download before building the recipe.
      await waitFor(() => {
        expect(mockGetDownloadFeatureTypes).toHaveBeenCalledWith('abc-123');
      });

      // Step 4: createExport gets the all-types per_feature_type recipe (type names from the fixture,
      // empty merge_steps).
      await waitFor(() => {
        expect(mockCreateExport).toHaveBeenCalledWith('abc-123', {
          version: 1,
          export_type: 'csv',
          mode: 'per_feature_type',
          feature_types: ['telemetry', 'deployment'],
          merge_steps: []
        });
      });

      // Step 5: List refreshes after create (initial load + refresh = 2).
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

  describe('handleConfigureExport / handleCreateConfigExport (config dialog)', () => {
    // Opens the Export menu and clicks "CSV — single combined file" for the (single) ready download.
    const openConfigDialog = async (findByTestId: (id: string) => Promise<HTMLElement>) => {
      fireEvent.click(await findByTestId('custom-menu-icon-Export'));
      fireEvent.click(await findByTestId('custom-menu-icon-item-CSV—singlecombinedfile'));
    };

    it('loads the download feature types and opens the config dialog when "CSV — single combined file" is picked', async () => {
      // Verifies: the configure path fetches feature types for THIS download and mounts the dialog.

      // Step 1: One ready download to configure.
      mockGetDownloads.mockResolvedValue({
        downloads: [makeDownload({ download_id: 'abc-123', download_status: 'ready' })],
        pagination: mockPagination()
      });

      const { findByTestId, getByText } = render(<DownloadSidebarDownloads />);

      // Step 2: Open the Export menu and pick "CSV — single combined file".
      await openConfigDialog(findByTestId);

      // Step 3: Feature types are fetched for the configured download.
      await waitFor(() => {
        expect(mockGetDownloadFeatureTypes).toHaveBeenCalledWith('abc-123');
      });

      // Step 4: The dialog mounts (title only renders when EditDialog is open).
      await waitFor(() => {
        expect(getByText('Combined CSV Export')).toBeVisible();
      });
    });

    it('submitting the dialog posts the built config, refreshes the list, then closes the dialog', async () => {
      // Verifies: a successful config submit POSTs the form-derived recipe, refreshes, and closes — the
      // real ConfigureExportDialog -> EditDialog -> ConfigureExportForm wiring is exercised (Monaco stubbed).

      // Step 1: Ready download + successful createExport.
      mockGetDownloads.mockResolvedValue({
        downloads: [makeDownload({ download_id: 'abc-123', download_status: 'ready' })],
        pagination: mockPagination()
      });
      mockCreateExport.mockResolvedValue({});

      const { findByTestId, getByTestId, getByRole, getByText, queryByText } = render(<DownloadSidebarDownloads />);

      // Step 2: Open the dialog and wait for the feature types to load (they default into the picker).
      await openConfigDialog(findByTestId);
      await waitFor(() => {
        expect(getByText('Combined CSV Export')).toBeVisible();
      });
      await waitFor(() => {
        expect(getByText('deployment')).toBeVisible();
      });

      // Step 3: Feature types default to all — choose one as the root (the combined export needs a root).
      fireEvent.mouseDown(getByRole('combobox', { name: /root feature type/i }));
      fireEvent.click(getByRole('option', { name: 'telemetry' }));

      // Step 4: Click the dialog's Create button to submit.
      fireEvent.click(getByTestId('edit-dialog-save-button'));

      // Step 5: createExport is called with the form-derived denormalized recipe (all types + the root).
      await waitFor(() => {
        expect(mockCreateExport).toHaveBeenCalledWith('abc-123', {
          version: 1,
          export_type: 'csv',
          mode: 'denormalized',
          feature_types: ['telemetry', 'deployment'],
          root_feature_type: 'telemetry',
          merge_steps: []
        });
      });

      // Step 6: List refreshes after create (initial load + refresh = 2).
      await waitFor(() => {
        expect(mockGetDownloads).toHaveBeenCalledTimes(2);
      });

      // Step 7: On success the dialog closes (title no longer rendered).
      await waitFor(() => {
        expect(queryByText('Combined CSV Export')).toBeNull();
      });
    });

    it('keeps the dialog open and snackbars the API message when createExport rejects', async () => {
      // Verifies: on a rejected recipe the server message reaches the snackbar verbatim and the dialog
      // stays open so the user can fix their picks (only success closes it).

      // Step 1: Ready download; createExport rejects with an APIError carrying a specific message.
      mockGetDownloads.mockResolvedValue({
        downloads: [makeDownload({ download_id: 'abc-123', download_status: 'ready' })],
        pagination: mockPagination()
      });
      mockCreateExport.mockRejectedValue(new APIError({ message: "feature type 'x' not found" } as any));

      const { findByTestId, getByTestId, getByRole, getByText } = render(<DownloadSidebarDownloads />);

      // Step 2: Open the dialog, wait for feature types to default in, then choose a root so submit passes.
      await openConfigDialog(findByTestId);
      await waitFor(() => {
        expect(getByText('Combined CSV Export')).toBeVisible();
      });
      await waitFor(() => {
        expect(getByText('deployment')).toBeVisible();
      });
      fireEvent.mouseDown(getByRole('combobox', { name: /root feature type/i }));
      fireEvent.click(getByRole('option', { name: 'telemetry' }));

      // Step 3: Submit.
      fireEvent.click(getByTestId('edit-dialog-save-button'));

      // Step 4: The API's message is surfaced verbatim in the snackbar.
      await waitFor(() => {
        expect(mockSetSnackbar).toHaveBeenCalledWith(
          expect.objectContaining({ open: true, snackbarMessage: "feature type 'x' not found" })
        );
      });

      // Step 5: The dialog stays open (title still rendered) — a failed create does not close it.
      expect(getByText('Combined CSV Export')).toBeVisible();
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
