import { cleanup, fireEvent } from '@testing-library/react';
import { type DownloadRecord } from 'interfaces/useDownloadApi.interface';
import { makeDownload, makeExport } from 'test-helpers/download-helpers';
import { render } from 'test-helpers/test-utils';
import { DownloadFeatureCard } from './DownloadFeatureCard';

const makeProps = (
  overrides: {
    download?: DownloadRecord;
    exports?: ReturnType<typeof makeExport>[];
  } = {}
) => ({
  download: overrides.download ?? makeDownload(),
  exports: overrides.exports ?? [],
  onCreateExport: vi.fn(),
  onDownloadExportPart: vi.fn(),
  onDownloadExportAllParts: vi.fn(),
  onRebuildExport: vi.fn()
});

describe('DownloadFeatureCard', () => {
  afterEach(() => {
    cleanup();
  });

  describe('status chip', () => {
    it.each([
      { status: 'pending', label: 'Pending' },
      { status: 'processing', label: 'Processing' },
      { status: 'ready', label: 'Ready' },
      { status: 'downloaded', label: 'Downloaded' },
      { status: 'failed', label: 'Failed' }
    ] as const)('renders chip with label "$label" for status "$status"', ({ status, label }) => {
      const props = makeProps({ download: makeDownload({ download_status: status }) });
      const { getByText } = render(<DownloadFeatureCard {...props} />);
      expect(getByText(label)).toBeVisible();
    });
  });

  describe('create date', () => {
    it('renders the formatted create date', () => {
      const expected = new Date('2026-03-01T00:00:00Z').toLocaleDateString();
      const { getByText } = render(<DownloadFeatureCard {...makeProps()} />);
      expect(getByText(expected)).toBeVisible();
    });
  });

  describe('Export menu gate', () => {
    it.each(['pending', 'processing', 'failed'] as const)(
      'hides the Export menu for non-ready status "%s"',
      (status) => {
        const props = makeProps({ download: makeDownload({ download_status: status }) });
        const { queryByTestId } = render(<DownloadFeatureCard {...props} />);
        expect(queryByTestId('custom-menu-icon-Export')).toBeNull();
      }
    );

    it('shows the Export menu when ready', () => {
      const props = makeProps({ download: makeDownload({ download_status: 'ready' }) });
      const { getByTestId } = render(<DownloadFeatureCard {...props} />);
      expect(getByTestId('custom-menu-icon-Export')).toBeVisible();
    });
  });

  describe('Export menu item', () => {
    it('fires onCreateExport(downloadId) when the "CSV — per feature type" item is clicked', () => {
      const props = makeProps({ download: makeDownload({ download_id: 'abc-123', download_status: 'ready' }) });
      const { getByTestId } = render(<DownloadFeatureCard {...props} />);
      fireEvent.click(getByTestId('custom-menu-icon-Export'));
      fireEvent.click(getByTestId('custom-menu-icon-item-CSV—perfeaturetype'));
      expect(props.onCreateExport).toHaveBeenCalledWith('abc-123');
    });
  });

  describe('Exports section', () => {
    it('renders no export-row elements when exports is empty', () => {
      const props = makeProps({ exports: [] });
      const { queryAllByTestId } = render(<DownloadFeatureCard {...props} />);
      // No way to "wildcard" data-testid with Testing Library, but we can query known ids instead.
      const rows = queryAllByTestId(/^export-row-/);
      expect(rows.length).toBe(0);
    });

    it('renders pending export rows with only the status chip — no spinner, no download button', () => {
      const props = makeProps({
        exports: [makeExport({ download_version_export_id: 'exp-1', status: 'pending', part_count: 0 })]
      });
      const { getByTestId, queryByTestId } = render(<DownloadFeatureCard {...props} />);
      expect(getByTestId('export-row-exp-1')).toBeInTheDocument();
      expect(queryByTestId('export-row-spinner-exp-1')).toBeNull();
      expect(queryByTestId('export-download-button-exp-1')).toBeNull();
      expect(queryByTestId('export-download-all-button-exp-1')).toBeNull();
      expect(queryByTestId('export-rebuild-button-exp-1')).toBeNull();
    });

    it('renders processing export rows with only the status chip — no spinner, no download button', () => {
      const props = makeProps({
        exports: [makeExport({ download_version_export_id: 'exp-1', status: 'processing', part_count: 0 })]
      });
      const { getByTestId, queryByTestId } = render(<DownloadFeatureCard {...props} />);
      expect(getByTestId('export-row-exp-1')).toBeInTheDocument();
      expect(queryByTestId('export-row-spinner-exp-1')).toBeNull();
      expect(queryByTestId('export-download-button-exp-1')).toBeNull();
    });

    it('renders failed export rows with error icon', () => {
      const props = makeProps({
        exports: [
          makeExport({
            download_version_export_id: 'exp-1',
            status: 'failed',
            part_count: 0,
            error_message: 'Pipeline blew up'
          })
        ]
      });
      const { getByTestId } = render(<DownloadFeatureCard {...props} />);
      expect(getByTestId('export-row-error-icon-exp-1')).toBeInTheDocument();
    });

    it('renders a single Download button for a single-part ready export', () => {
      const props = makeProps({
        exports: [makeExport({ download_version_export_id: 'exp-1', status: 'ready', part_count: 1 })]
      });
      const { getByTestId, queryByTestId } = render(<DownloadFeatureCard {...props} />);
      expect(getByTestId('export-download-button-exp-1')).toBeInTheDocument();
      expect(queryByTestId('export-download-all-button-exp-1')).toBeNull();
      expect(queryByTestId('export-rebuild-button-exp-1')).toBeNull();
    });

    it('fires onDownloadExportPart(exportId, 1) when the single-part download is clicked', () => {
      const props = makeProps({
        exports: [makeExport({ download_version_export_id: 'exp-1', status: 'ready', part_count: 1 })]
      });
      const { getByTestId } = render(<DownloadFeatureCard {...props} />);
      fireEvent.click(getByTestId('export-download-button-exp-1'));
      expect(props.onDownloadExportPart).toHaveBeenCalledWith('exp-1', 1);
    });

    it('renders a rebuild button for ready + part_count === 0 and fires onRebuildExport on click', () => {
      const props = makeProps({
        exports: [makeExport({ download_version_export_id: 'exp-1', status: 'ready', part_count: 0 })]
      });
      const { getByTestId, queryByTestId } = render(<DownloadFeatureCard {...props} />);
      expect(getByTestId('export-rebuild-button-exp-1')).toBeInTheDocument();
      expect(queryByTestId('export-download-button-exp-1')).toBeNull();
      fireEvent.click(getByTestId('export-rebuild-button-exp-1'));
      expect(props.onRebuildExport).toHaveBeenCalledWith('exp-1');
    });

    it('renders Download-all + collapsed parts list for multi-part ready export', () => {
      const props = makeProps({
        exports: [makeExport({ download_version_export_id: 'exp-1', status: 'ready', part_count: 3 })]
      });
      const { getByTestId, queryByTestId } = render(<DownloadFeatureCard {...props} />);
      expect(getByTestId('export-download-all-button-exp-1')).toBeInTheDocument();
      // Parts collapsed by default — the Collapse wrapper renders children with display:none,
      // but testing-library still finds them in the DOM. Check via Collapse's `in` prop effect:
      expect(getByTestId('export-toggle-parts-exp-1')).toHaveTextContent(/show/i);
      // Clicking a part-download button should not be required before expansion; but the visible
      // user signal is the "Show individual parts" label.
      expect(queryByTestId('export-download-all-button-exp-1')).toBeInTheDocument();
    });

    it('expands and collapses the individual parts list when toggle is clicked', () => {
      const props = makeProps({
        exports: [makeExport({ download_version_export_id: 'exp-1', status: 'ready', part_count: 2 })]
      });
      const { getByTestId } = render(<DownloadFeatureCard {...props} />);
      const toggle = getByTestId('export-toggle-parts-exp-1');
      expect(toggle).toHaveTextContent(/show/i);
      fireEvent.click(toggle);
      expect(toggle).toHaveTextContent(/hide/i);
      fireEvent.click(toggle);
      expect(toggle).toHaveTextContent(/show/i);
    });

    it('fires onDownloadExportPart with 1-based chunk when a part-download is clicked', () => {
      const props = makeProps({
        exports: [makeExport({ download_version_export_id: 'exp-1', status: 'ready', part_count: 3 })]
      });
      const { getByTestId } = render(<DownloadFeatureCard {...props} />);
      // Expand first so the part buttons are visible (MUI Collapse still mounts children, but
      // we mirror user behaviour — click toggle then click part).
      fireEvent.click(getByTestId('export-toggle-parts-exp-1'));
      fireEvent.click(getByTestId('export-download-part-button-exp-1-2'));
      expect(props.onDownloadExportPart).toHaveBeenCalledWith('exp-1', 2);
    });

    it('fires onDownloadExportAllParts when the Download-all button is clicked', () => {
      const props = makeProps({
        exports: [makeExport({ download_version_export_id: 'exp-1', status: 'ready', part_count: 3 })]
      });
      const { getByTestId } = render(<DownloadFeatureCard {...props} />);
      fireEvent.click(getByTestId('export-download-all-button-exp-1'));
      expect(props.onDownloadExportAllParts).toHaveBeenCalledWith('exp-1');
    });

    it('renders exports in the order provided (card does not sort)', () => {
      const newer = makeExport({ download_version_export_id: 'exp-newer', completed_at: '2026-04-22T02:00:00Z' });
      const older = makeExport({ download_version_export_id: 'exp-older', completed_at: '2026-04-22T01:00:00Z' });
      const props = makeProps({ exports: [newer, older] });
      const { getAllByTestId } = render(<DownloadFeatureCard {...props} />);
      const rowIds = getAllByTestId(/^export-row-/).map((el) => el.getAttribute('data-testid'));
      expect(rowIds).toEqual(['export-row-exp-newer', 'export-row-exp-older']);
    });
  });
});
