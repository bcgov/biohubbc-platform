import { cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import { DownloadDetail, DownloadVersion } from 'interfaces/useDownloadApi.interface';
import { DownloadExportDetail, DownloadExportListResponse } from 'interfaces/useDownloadExportApi.interface';
import { MemoryRouter, Route, Routes } from 'react-router';
import { render } from 'test-helpers/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { DownloadVersionPage } from './DownloadVersionPage';

const mockGetDownload = vi.fn();
const mockGetDownloadVersion = vi.fn();
const mockGetDownloadVersionFeatureTypes = vi.fn();
const mockCreateExport = vi.fn();
const mockListDownloadVersionExports = vi.fn();
const mockGetExport = vi.fn();
const { mockTriggerIframeDownload } = vi.hoisted(() => ({ mockTriggerIframeDownload: vi.fn() }));

vi.mock('hooks/useApi', () => ({
  useApi: () => ({
    download: {
      getDownload: mockGetDownload,
      getDownloadVersion: mockGetDownloadVersion
    },
    downloadExport: {
      getDownloadVersionFeatureTypes: mockGetDownloadVersionFeatureTypes,
      createExport: mockCreateExport,
      listDownloadVersionExports: mockListDownloadVersionExports,
      getExport: mockGetExport
    }
  })
}));

vi.mock('utils/download', () => ({
  triggerIframeDownload: mockTriggerIframeDownload
}));

const DOWNLOAD_ID = '11111111-2222-3333-4444-555555555555';
const VERSION_ID = '22222222-3333-4444-5555-666666666666';

const download: DownloadDetail = {
  download_id: DOWNLOAD_ID,
  download_version_id: VERSION_ID,
  status: 'ready',
  name: 'Bears in BC',
  description: 'All bear observations within BC',
  started_at: null,
  completed_at: null,
  downloaded_at: null
};

const version: DownloadVersion = {
  download_version_id: VERSION_ID,
  download_id: DOWNLOAD_ID,
  status: 'ready',
  feature_count: 42,
  started_at: null,
  completed_at: null,
  materialized_at: null,
  error_message: null,
  create_date: '2026-03-01T12:00:00Z'
};

/**
 * Render the download-version page at its canonical route.
 *
 * @return {ReturnType<typeof render>} Testing Library render utilities for the page.
 */
const renderPage = (): ReturnType<typeof render> =>
  render(
    <MemoryRouter initialEntries={[`/download/${DOWNLOAD_ID}/version/${VERSION_ID}`]}>
      <Routes>
        <Route path="/download/:downloadId/version/:downloadVersionId" element={<DownloadVersionPage />} />
      </Routes>
    </MemoryRouter>
  );

describe('DownloadVersionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDownload.mockResolvedValue(download);
    mockGetDownloadVersion.mockResolvedValue(version);
    mockGetDownloadVersionFeatureTypes.mockResolvedValue([{ feature_type: 'observation', columns: ['uuid'] }]);
    mockCreateExport.mockResolvedValue({});
    const exportsResponse: DownloadExportListResponse = {
      exports: [
        {
          download_version_export_id: '33333333-4444-5555-6666-777777777777',
          download_id: DOWNLOAD_ID,
          format: 'csv',
          mode: 'per_feature_type',
          status: 'ready',
          max_part_size_bytes: '524288000',
          part_count: 2,
          started_at: '2026-03-02T00:00:00Z',
          completed_at: '2026-03-02T00:01:00Z',
          error_message: null
        }
      ],
      pagination: { total: 1, current_page: 1, last_page: 1 }
    };
    mockListDownloadVersionExports.mockResolvedValue(exportsResponse);
    const exportDetail: DownloadExportDetail = {
      ...exportsResponse.exports[0],
      parts: [
        { chunk_id: 1, file_size_bytes: '1024', url: 'https://object-store.example/export-part-1' },
        { chunk_id: 2, file_size_bytes: '2048', url: 'https://object-store.example/export-part-2' }
      ]
    };
    mockGetExport.mockResolvedValue(exportDetail);
  });

  afterEach(cleanup);

  it('renders the download header with Features and Exports tabs', async () => {
    const { findByRole, getByRole, getByText } = renderPage();

    expect(await findByRole('heading', { name: 'Bears in BC' })).toBeVisible();
    expect(getByRole('link', { name: 'Bears in BC' })).toHaveAttribute('href', `/download/${DOWNLOAD_ID}`);
    const breadcrumb = getByRole('navigation', { name: 'download version breadcrumb' });
    expect(within(breadcrumb).getByRole('link', { name: 'Downloads' })).toHaveAttribute('href', '/downloads');
    expect(within(breadcrumb).queryByText('Search')).not.toBeInTheDocument();
    expect(breadcrumb).toHaveTextContent('March 1, 2026');
    expect(within(breadcrumb).queryByRole('link', { name: 'March 1, 2026' })).not.toBeInTheDocument();
    expect(getByRole('button', { name: 'Export' })).toBeVisible();
    expect(getByRole('heading', { name: 'Features' })).toBeVisible();
    expect(getByText('Failed to load rows')).toBeVisible();
    expect(getByRole('tab', { name: 'Features' })).toBeVisible();
    expect(getByRole('tab', { name: 'Exports' })).toBeVisible();
    expect(mockGetDownloadVersion).toHaveBeenCalledWith(DOWNLOAD_ID, VERSION_ID);
  });

  it('lists only this version exports on the Exports tab', async () => {
    const { findByRole, findByText, queryByText } = renderPage();

    fireEvent.click(await findByRole('tab', { name: 'Exports' }));

    expect(await findByText('33333333-4444-5555-6666-777777777777')).toBeVisible();
    expect(await findByRole('button', { name: 'Download' })).toBeVisible();
    expect(queryByText('Actions')).not.toBeInTheDocument();
    expect(mockListDownloadVersionExports).toHaveBeenCalledWith(
      DOWNLOAD_ID,
      VERSION_ID,
      expect.objectContaining({ page: 1, limit: 10, sort: 'started_at', order: 'desc' })
    );
  });

  it('downloads every part of a ready export to the client', async () => {
    const { findByRole } = renderPage();

    fireEvent.click(await findByRole('tab', { name: 'Exports' }));
    fireEvent.click(await findByRole('button', { name: 'Download' }));

    await waitFor(() => {
      expect(mockGetExport).toHaveBeenCalledWith(DOWNLOAD_ID, '33333333-4444-5555-6666-777777777777');
      expect(mockTriggerIframeDownload).toHaveBeenCalledTimes(2);
    });
    expect(mockTriggerIframeDownload).toHaveBeenNthCalledWith(1, 'https://object-store.example/export-part-1');
    expect(mockTriggerIframeDownload).toHaveBeenNthCalledWith(2, 'https://object-store.example/export-part-2');
  });

  it('starts an export for this version from the header CTA', async () => {
    const { findByRole } = renderPage();

    fireEvent.click(await findByRole('button', { name: 'Export' }));

    await waitFor(() => {
      expect(mockGetDownloadVersionFeatureTypes).toHaveBeenCalledWith(DOWNLOAD_ID, VERSION_ID);
      expect(mockCreateExport).toHaveBeenCalledWith(
        DOWNLOAD_ID,
        expect.objectContaining({ download_version_id: VERSION_ID, feature_types: ['observation'] })
      );
    });
  });
});
