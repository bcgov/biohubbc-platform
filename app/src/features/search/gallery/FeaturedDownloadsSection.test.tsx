import { cleanup, fireEvent, waitFor } from '@testing-library/react';
import { GalleryDownloadTile } from 'interfaces/useGalleryApi.interface';
import { MemoryRouter, Route, Routes } from 'react-router';
import { render } from 'test-helpers/test-utils';
import { FeaturedDownloadsSection } from './FeaturedDownloadsSection';

const mockGetGalleryDownloadsBySlug = vi.fn();

vi.mock('hooks/useApi', () => ({
  useApi: () => ({
    gallery: { getGalleryDownloadsBySlug: mockGetGalleryDownloadsBySlug }
  })
}));

const mockPagination = (overrides = {}) => ({ total: 1, current_page: 1, last_page: 1, ...overrides });

const makeTile = (overrides: Partial<GalleryDownloadTile> = {}): GalleryDownloadTile => ({
  download_id: 'd1',
  download_version_id: 'ver-d1',
  download_status: 'ready',
  format: 'parquet',
  metadata: null,
  started_at: '2026-01-01T00:00:00Z',
  completed_at: '2026-01-01T01:00:00Z',
  downloaded_at: null,
  create_date: '2026-01-01T00:00:00Z',
  name: 'Bears in BC',
  description: 'All bear observations within BC',
  feature_count: 412,
  ...overrides
});

const renderSection = () =>
  render(
    <MemoryRouter>
      <FeaturedDownloadsSection />
    </MemoryRouter>
  );

describe('FeaturedDownloadsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('fetches the home gallery by slug with page 1 and the fixed tile limit on mount', async () => {
    mockGetGalleryDownloadsBySlug.mockResolvedValue({
      downloads: [makeTile()],
      pagination: mockPagination()
    });

    renderSection();

    await waitFor(() => {
      expect(mockGetGalleryDownloadsBySlug).toHaveBeenCalledWith('home', { page: 1, limit: 9 });
    });
  });

  it('fails closed on a fetch error: renders nothing — no heading, no shell', async () => {
    const notFound = new Error('status 404') as Error & { status: number };
    notFound.status = 404;
    mockGetGalleryDownloadsBySlug.mockRejectedValue(notFound);

    const { container, queryByText } = renderSection();

    await waitFor(() => {
      expect(mockGetGalleryDownloadsBySlug).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
    expect(queryByText('Featured Downloads')).not.toBeInTheDocument();
  });

  it('fails closed on zero downloads: a resolved empty result renders nothing', async () => {
    mockGetGalleryDownloadsBySlug.mockResolvedValue({
      downloads: [],
      pagination: mockPagination({ total: 0 })
    });

    const { container } = renderSection();

    await waitFor(() => {
      expect(mockGetGalleryDownloadsBySlug).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  it('fails closed while loading: container is empty synchronously after render', () => {
    mockGetGalleryDownloadsBySlug.mockReturnValue(new Promise(() => {}));

    const { container } = renderSection();

    expect(container).toBeEmptyDOMElement();
  });

  it('renders the heading and a tile per download; a null description renders no stray text', async () => {
    mockGetGalleryDownloadsBySlug.mockResolvedValue({
      downloads: [
        makeTile({ download_id: 'd1', name: 'Bears in BC' }),
        makeTile({ download_id: 'd2', name: 'Moose in BC', description: null })
      ],
      pagination: mockPagination({ total: 2 })
    });

    const { getByText, queryByText } = renderSection();

    await waitFor(() => {
      expect(getByText('Featured Downloads')).toBeVisible();
    });
    expect(getByText('Bears in BC')).toBeVisible();
    expect(getByText('Moose in BC')).toBeVisible();
    expect(queryByText(/null/)).toBeNull();
  });

  it('routes feature_count through the formatter: formatted line shown, null count omits the line', async () => {
    mockGetGalleryDownloadsBySlug.mockResolvedValue({
      downloads: [
        makeTile({ download_id: 'd1', name: 'Alpha', description: 'First dataset', feature_count: 17412 }),
        makeTile({ download_id: 'd2', name: 'Beta', description: 'Second dataset', feature_count: null })
      ],
      pagination: mockPagination({ total: 2 })
    });

    const { getByText, getAllByText, queryByText } = renderSection();

    await waitFor(() => {
      expect(getByText('17.4k features')).toBeVisible();
    });
    expect(queryByText('null features')).toBeNull();
    expect(getAllByText(/features/)).toHaveLength(1);
  });

  it('navigates to the download landing page when a tile is clicked', async () => {
    mockGetGalleryDownloadsBySlug.mockResolvedValue({
      downloads: [makeTile({ download_id: 'abc-123', name: 'Bears in BC' })],
      pagination: mockPagination()
    });

    const { getByText, getByTestId } = render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<FeaturedDownloadsSection />} />
          <Route path="/download/:downloadId" element={<div data-testid="download-page-probe" />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(getByText('Bears in BC')).toBeVisible();
    });

    fireEvent.click(getByText('Bears in BC'));

    await waitFor(() => {
      expect(getByTestId('download-page-probe')).toBeInTheDocument();
    });
  });

  it('hides the pager when there is only one page', async () => {
    mockGetGalleryDownloadsBySlug.mockResolvedValue({
      downloads: [makeTile()],
      pagination: mockPagination({ last_page: 1 })
    });

    const { getByText, queryByRole } = renderSection();

    await waitFor(() => {
      expect(getByText('Featured Downloads')).toBeVisible();
    });
    expect(queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('shows the pager across multiple pages and refetches with the new page number', async () => {
    mockGetGalleryDownloadsBySlug.mockResolvedValue({
      downloads: [makeTile()],
      pagination: mockPagination({ total: 25, last_page: 3 })
    });

    const { getByRole } = renderSection();

    await waitFor(() => {
      expect(getByRole('navigation')).toBeVisible();
    });

    fireEvent.click(getByRole('button', { name: /go to page 2/i }));

    await waitFor(() => {
      expect(mockGetGalleryDownloadsBySlug).toHaveBeenCalledWith('home', { page: 2, limit: 9 });
    });
  });
});
