import { cleanup } from '@testing-library/react';
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

  describe('status chip', () => {
    it.each([
      { status: 'pending', label: 'Pending' },
      { status: 'processing', label: 'Processing' },
      { status: 'ready', label: 'Ready' },
      { status: 'downloaded', label: 'Downloaded' },
      { status: 'failed', label: 'Failed' }
    ] as const)('renders chip with label "$label" for status "$status"', ({ status, label }) => {
      const { getByText } = render(<DownloadFeatureCard download={makeDownload({ download_status: status })} />);
      expect(getByText(label)).toBeVisible();
    });

    it('falls back to the raw status string for an unknown status', () => {
      // Cast is safe: render path tolerates any string via the ?? fallback in the component.
      const { getByText } = render(
        <DownloadFeatureCard
          download={makeDownload({ download_status: 'mystery-status' as DownloadRecord['download_status'] })}
        />
      );
      expect(getByText('mystery-status')).toBeVisible();
    });
  });

  describe('placeholder (no interactive elements)', () => {
    it('renders the formatted create date', () => {
      const expected = new Date('2026-03-01T00:00:00Z').toLocaleDateString();
      const { getByText } = render(<DownloadFeatureCard download={makeDownload()} />);
      expect(getByText(expected)).toBeVisible();
    });

    it('renders no buttons, even when status is ready', () => {
      const { container } = render(<DownloadFeatureCard download={makeDownload({ download_status: 'ready' })} />);
      expect(container.querySelector('button')).toBeNull();
    });
  });
});
