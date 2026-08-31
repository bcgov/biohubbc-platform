import { cleanup, fireEvent, waitFor } from '@testing-library/react';
import { DownloadDetail, DownloadVersion, DownloadVersionListResponse } from 'interfaces/useDownloadApi.interface';
import { DownloadExport, DownloadExportListResponse } from 'interfaces/useDownloadExportApi.interface';
import { MemoryRouter, Route, Routes } from 'react-router';
import { render } from 'test-helpers/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { DownloadPage } from './DownloadPage';

const mockGetDownload = vi.fn();
const mockListDownloadVersions = vi.fn();
const mockGetExports = vi.fn();

vi.mock('hooks/useApi', () => ({
  useApi: () => ({
    download: {
      getDownload: mockGetDownload,
      listDownloadVersions: mockListDownloadVersions
    },
    downloadExport: {
      getExports: mockGetExports
    }
  })
}));

const DOWNLOAD_ID = '11111111-2222-3333-4444-555555555555';
const VERSION_ID = '22222222-3333-4444-5555-666666666666';
const EXPORT_ID = '33333333-4444-5555-6666-777777777777';

const makeDownload = (overrides: Partial<DownloadDetail> = {}): DownloadDetail => ({
  download_id: DOWNLOAD_ID,
  download_version_id: VERSION_ID,
  status: 'ready',
  name: 'Bears in BC',
  description: 'All bear observations within BC',
  started_at: null,
  completed_at: null,
  downloaded_at: null,
  ...overrides
});

const makeVersion = (overrides: Partial<DownloadVersion> = {}): DownloadVersion => ({
  download_version_id: VERSION_ID,
  download_id: DOWNLOAD_ID,
  status: 'ready',
  feature_count: 42,
  started_at: '2026-03-01T00:01:00Z',
  completed_at: '2026-03-01T00:02:00Z',
  materialized_at: '2026-03-01T00:02:00Z',
  error_message: null,
  create_date: '2026-03-01T00:00:00Z',
  ...overrides
});

const makeExport = (overrides: Partial<DownloadExport> = {}): DownloadExport => ({
  download_version_export_id: EXPORT_ID,
  download_id: DOWNLOAD_ID,
  format: 'csv',
  mode: 'per_feature_type',
  status: 'ready',
  max_part_size_bytes: '524288000',
  part_count: 2,
  started_at: '2026-04-22T00:00:00Z',
  completed_at: '2026-04-22T00:01:00Z',
  error_message: null,
  ...overrides
});

const makeVersionsResponse = (versions: DownloadVersion[] = [makeVersion()]): DownloadVersionListResponse => ({
  versions,
  pagination: { total: versions.length, current_page: 1, last_page: 1 }
});

const makeExportsResponse = (exports: DownloadExport[] = [makeExport()]): DownloadExportListResponse => ({
  exports,
  pagination: { total: exports.length, current_page: 1, last_page: 1 }
});

const makeApiError = (status: number) => {
  const err = new Error(`status ${status}`) as Error & { status: number; name: string };
  err.status = status;
  err.name = 'APIError';
  return err;
};

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/download/:downloadId" element={<DownloadPage />} />
      </Routes>
    </MemoryRouter>
  );

describe('DownloadPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDownload.mockResolvedValue(makeDownload());
    mockListDownloadVersions.mockResolvedValue(makeVersionsResponse());
    mockGetExports.mockResolvedValue(makeExportsResponse());
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the download header with Versions and Exports tabs', async () => {
    const { findByRole, getAllByText, getByRole, getByText } = renderAt(`/download/${DOWNLOAD_ID}`);

    expect(await findByRole('heading', { name: 'Download' })).toBeVisible();
    expect(getAllByText('Bears in BC')[0]).toBeVisible();
    expect(getByText('All bear observations within BC')).toBeVisible();
    expect(getByRole('link', { name: 'Search' })).toHaveAttribute('href', '/search');
    expect(getByRole('link', { name: 'Downloads' })).toHaveAttribute('href', '/downloads');
    expect(getByRole('link', { name: 'Bears in BC' })).toHaveAttribute('href', `/download/${DOWNLOAD_ID}`);
    expect(await findByRole('tab', { name: 'Versions' })).toBeVisible();
    expect(await findByRole('tab', { name: 'Exports' })).toBeVisible();
  });

  it('renders the Versions tab as the default paginated table', async () => {
    const { findByText, getByText } = renderAt(`/download/${DOWNLOAD_ID}`);

    expect(await findByText(VERSION_ID)).toBeVisible();
    expect(
      getByText((_content, element) => element?.tagName === 'H2' && element.textContent === 'Versions (1)')
    ).toBeVisible();
    expect(getByText('Feature count')).toBeVisible();
    expect(getByText('42')).toBeVisible();
    expect(mockListDownloadVersions).toHaveBeenCalledWith(
      DOWNLOAD_ID,
      expect.objectContaining({ page: 1, limit: 10, sort: 'create_date', order: 'desc' })
    );
    expect(mockGetExports).not.toHaveBeenCalled();
  });

  it('renders the Exports tab table when selected', async () => {
    const { findByRole, findByText, getByText } = renderAt(`/download/${DOWNLOAD_ID}`);

    fireEvent.click(await findByRole('tab', { name: 'Exports' }));

    expect(await findByText(EXPORT_ID)).toBeVisible();
    expect(
      getByText((_content, element) => element?.tagName === 'H2' && element.textContent === 'Exports (1)')
    ).toBeVisible();
    expect(getByText('per feature type')).toBeVisible();
    expect(getByText('2')).toBeVisible();
    expect(mockGetExports).toHaveBeenCalledWith(
      DOWNLOAD_ID,
      expect.objectContaining({ page: 1, limit: 10, sort: 'started_at', order: 'desc' })
    );
  });

  it('refreshes tab data when switching back to a remounted tab', async () => {
    const { findByRole, findByText } = renderAt(`/download/${DOWNLOAD_ID}`);

    expect(await findByText(VERSION_ID)).toBeVisible();
    expect(mockListDownloadVersions).toHaveBeenCalledTimes(1);
    expect(mockGetExports).not.toHaveBeenCalled();

    fireEvent.click(await findByRole('tab', { name: 'Exports' }));

    expect(await findByText(EXPORT_ID)).toBeVisible();
    expect(mockGetExports).toHaveBeenCalledTimes(1);

    fireEvent.click(await findByRole('tab', { name: 'Versions' }));

    await waitFor(() => {
      expect(mockListDownloadVersions).toHaveBeenCalledTimes(2);
    });
  });

  it('renders the dead-end card when the API returns 404', async () => {
    mockGetDownload.mockRejectedValue(makeApiError(404));

    const { getByText, queryByRole } = renderAt(`/download/${DOWNLOAD_ID}`);

    await waitFor(() => {
      expect(getByText('Download not available')).toBeVisible();
    });
    expect(queryByRole('tab', { name: 'Versions' })).not.toBeInTheDocument();
  });

  it('renders the same dead-end card when the API returns 403', async () => {
    mockGetDownload.mockRejectedValue(makeApiError(403));

    const { getByText, queryByRole } = renderAt(`/download/${DOWNLOAD_ID}`);

    await waitFor(() => {
      expect(getByText('Download not available')).toBeVisible();
    });
    expect(queryByRole('tab', { name: 'Exports' })).not.toBeInTheDocument();
  });

  it('renders identically regardless of auth state', async () => {
    const { findAllByText, findByText } = renderAt(`/download/${DOWNLOAD_ID}`);

    expect(await findByText(VERSION_ID)).toBeVisible();
    expect((await findAllByText('Bears in BC'))[0]).toBeVisible();
  });
});
