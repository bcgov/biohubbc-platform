import { cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import { DATE_FORMAT } from 'constants/dateTimeFormats';
import dayjs from 'dayjs';
import { DownloadDetail, DownloadVersion, DownloadVersionListResponse } from 'interfaces/useDownloadApi.interface';
import { MemoryRouter, Route, Routes } from 'react-router';
import { render } from 'test-helpers/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { DownloadPage } from './DownloadPage';

const mockGetDownload = vi.fn();
const mockListDownloadVersions = vi.fn();
const mockGetDownloadVersionFeatureTypes = vi.fn();
const mockCreateExport = vi.fn();

vi.mock('hooks/useApi', () => ({
  useApi: () => ({
    download: {
      getDownload: mockGetDownload,
      listDownloadVersions: mockListDownloadVersions
    },
    downloadExport: {
      getDownloadVersionFeatureTypes: mockGetDownloadVersionFeatureTypes,
      createExport: mockCreateExport
    }
  })
}));

const DOWNLOAD_ID = '11111111-2222-3333-4444-555555555555';
const VERSION_ID = '22222222-3333-4444-5555-666666666666';

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

const makeVersionsResponse = (versions: DownloadVersion[] = [makeVersion()]): DownloadVersionListResponse => ({
  versions,
  pagination: { total: versions.length, current_page: 1, last_page: 1 }
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
        <Route
          path="/download/:downloadId/version/:downloadVersionId"
          element={<div>Version detail destination</div>}
        />
      </Routes>
    </MemoryRouter>
  );

describe('DownloadPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDownload.mockResolvedValue(makeDownload());
    mockListDownloadVersions.mockResolvedValue(makeVersionsResponse());
    mockGetDownloadVersionFeatureTypes.mockResolvedValue([{ feature_type: 'observation', columns: ['uuid'] }]);
    mockCreateExport.mockResolvedValue({});
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the download header with only the Versions tab', async () => {
    const { findByRole, getAllByText, getByRole, getByText, queryByRole } = renderAt(`/download/${DOWNLOAD_ID}`);

    expect(await findByRole('heading', { name: 'Bears in BC' })).toBeVisible();
    expect(getAllByText('Bears in BC')[0]).toBeVisible();
    expect(getByText('All bear observations within BC')).toBeVisible();
    expect(getByRole('link', { name: 'Downloads' })).toHaveAttribute('href', '/downloads');
    const breadcrumb = getByRole('navigation', { name: 'download breadcrumb' });
    expect(within(breadcrumb).queryByText('Search')).not.toBeInTheDocument();
    expect(within(breadcrumb).getByText('Bears in BC')).not.toHaveAttribute('href');
    expect(within(breadcrumb).queryByRole('link', { name: 'Bears in BC' })).not.toBeInTheDocument();
    expect(await findByRole('tab', { name: 'Versions' })).toBeVisible();
    expect(queryByRole('tab', { name: 'Exports' })).not.toBeInTheDocument();
  });

  it('renders the paginated versions table', async () => {
    const { findByText, getByText, queryByText } = renderAt(`/download/${DOWNLOAD_ID}`);

    expect(await findByText(VERSION_ID)).toBeVisible();
    expect(
      getByText((_content, element) => element?.tagName === 'H2' && element.textContent === 'Versions (1)')
    ).toBeVisible();
    expect(getByText('Status')).toBeVisible();
    expect(getByText('Created at')).toBeVisible();
    expect(getByText(dayjs(makeVersion().create_date).format(DATE_FORMAT.MediumDateFormat))).toBeVisible();
    expect(getByText('Export')).toBeVisible();
    expect(queryByText('Feature count')).not.toBeInTheDocument();
    expect(queryByText('Started')).not.toBeInTheDocument();
    expect(mockListDownloadVersions).toHaveBeenCalledWith(
      DOWNLOAD_ID,
      expect.objectContaining({ page: 1, limit: 10, sort: 'create_date', order: 'desc' })
    );
  });

  it('starts an export for the selected version without navigating the row', async () => {
    const { findByRole, queryByText } = renderAt(`/download/${DOWNLOAD_ID}`);

    fireEvent.click(await findByRole('button', { name: 'Export' }));

    await waitFor(() => {
      expect(mockCreateExport).toHaveBeenCalledWith(
        DOWNLOAD_ID,
        expect.objectContaining({ download_version_id: VERSION_ID, feature_types: ['observation'] })
      );
    });
    expect(queryByText('Version detail destination')).not.toBeInTheDocument();
  });

  it('navigates to the selected download version', async () => {
    const { findByText } = renderAt(`/download/${DOWNLOAD_ID}`);

    const versionId = await findByText(VERSION_ID);
    fireEvent.click(versionId.closest('.MuiDataGrid-row')!);

    expect(await findByText('Version detail destination')).toBeVisible();
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
