import { cleanup, fireEvent } from '@testing-library/react';
import { DownloadRecord } from 'interfaces/useDownloadApi.interface';
import { render } from 'test-helpers/test-utils';
import { DownloadFeatureCard } from './DownloadFeatureCard';

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

describe('DownloadFeatureCard', () => {
  afterEach(() => {
    cleanup();
  });

  describe('download button visibility', () => {
    it('shows download button when status is ready', () => {
      const { getByTestId } = render(
        <DownloadFeatureCard download={makeDownload({ download_status: 'ready' })} onDownloadFragment={vi.fn()} />
      );
      expect(getByTestId('download-button')).toBeVisible();
    });

    it('shows download button when status is downloaded', () => {
      const { getByTestId } = render(
        <DownloadFeatureCard download={makeDownload({ download_status: 'downloaded' })} onDownloadFragment={vi.fn()} />
      );
      expect(getByTestId('download-button')).toBeVisible();
    });

    it.each(['pending', 'processing', 'failed'] as const)(
      'does not show download button when status is %s',
      (status) => {
        const { queryByTestId } = render(
          <DownloadFeatureCard download={makeDownload({ download_status: status })} onDownloadFragment={vi.fn()} />
        );
        expect(queryByTestId('download-button')).not.toBeInTheDocument();
      }
    );
  });

  describe('single-fragment download', () => {
    it('calls onDownloadFragment with (id, 0) when download button is clicked', () => {
      const onDownloadFragment = vi.fn();
      const { getByTestId } = render(
        <DownloadFeatureCard
          download={makeDownload({ download_id: 'xyz-789', total_fragments: 1 })}
          onDownloadFragment={onDownloadFragment}
        />
      );
      fireEvent.click(getByTestId('download-button'));
      expect(onDownloadFragment).toHaveBeenCalledWith('xyz-789', 0);
    });

    it('does not show parts UI for single-fragment downloads', () => {
      const { queryByText } = render(
        <DownloadFeatureCard download={makeDownload({ total_fragments: 1 })} onDownloadFragment={vi.fn()} />
      );
      expect(queryByText(/Part \d+ of/)).not.toBeInTheDocument();
    });
  });

  describe('multi-fragment download', () => {
    it('renders part rows with correct labels and download buttons', () => {
      const onDownloadFragment = vi.fn();
      const { getByText, getAllByTestId } = render(
        <DownloadFeatureCard
          download={makeDownload({ download_id: 'multi-1', total_fragments: 3 })}
          onDownloadFragment={onDownloadFragment}
        />
      );

      expect(getByText('Part 1 of 3')).toBeVisible();
      expect(getByText('Part 2 of 3')).toBeVisible();
      expect(getByText('Part 3 of 3')).toBeVisible();

      const partButtons = getAllByTestId(/^download-part-button-/);
      expect(partButtons).toHaveLength(3);

      fireEvent.click(partButtons[1]);
      expect(onDownloadFragment).toHaveBeenCalledWith('multi-1', 1);
    });
  });

  describe('status chip', () => {
    it.each([
      { status: 'pending', label: 'Pending' },
      { status: 'processing', label: 'Processing' },
      { status: 'ready', label: 'Ready' },
      { status: 'downloaded', label: 'Downloaded' },
      { status: 'failed', label: 'Failed' }
    ] as const)('renders chip with label "$label" for status "$status"', ({ status, label }) => {
      const { getByText } = render(
        <DownloadFeatureCard download={makeDownload({ download_status: status })} onDownloadFragment={vi.fn()} />
      );
      expect(getByText(label)).toBeVisible();
    });
  });
});
