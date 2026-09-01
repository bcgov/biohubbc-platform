import { cleanup, fireEvent } from '@testing-library/react';
import { DATE_FORMAT } from 'constants/dateTimeFormats';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { makeDownload } from 'test-helpers/download-helpers';
import { render } from 'test-helpers/test-utils';
import { getFormattedDate } from 'utils/Utils';
import { PortalDownloadPage } from './PortalDownloadPage';

const mockGetDownloads = vi.fn();

vi.mock('hooks/useApi', () => ({
  useApi: () => ({
    download: { getDownloads: mockGetDownloads }
  })
}));

const DOWNLOAD_ID = '11111111-2222-3333-4444-555555555555';
const download = makeDownload({
  download_id: DOWNLOAD_ID,
  name: 'Wetland observations',
  description: 'Observations within wetland boundaries',
  create_date: '2026-08-30T12:00:00Z'
});

/**
 * Render the Portal downloads page and its detail-page destination.
 *
 * @return {ReturnType<typeof render>} Testing Library utilities for the rendered routes.
 */
const renderPage = (): ReturnType<typeof render> =>
  render(
    <MemoryRouter initialEntries={['/portal/download']}>
      <Routes>
        <Route path="/portal/download" element={<PortalDownloadPage />} />
        <Route path="/download/:downloadId" element={<div>Download detail destination</div>} />
      </Routes>
    </MemoryRouter>
  );

describe('PortalDownloadPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDownloads.mockResolvedValue({
      downloads: [download],
      pagination: { total: 1, current_page: 1, last_page: 1 }
    });
  });

  afterEach(cleanup);

  it('lists downloads available through the current user endpoint', async () => {
    const { findByText, getByText } = renderPage();

    expect(await findByText('Wetland observations')).toBeVisible();
    expect(getByText('Observations within wetland boundaries')).toBeVisible();
    expect(getByText('Ready')).toBeVisible();
    expect(getByText(getFormattedDate(DATE_FORMAT.ShortMediumDateFormat, download.create_date))).toBeVisible();
    expect(mockGetDownloads).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 10, sort: 'create_date', order: 'desc' })
    );
  });

  it('navigates to the selected download', async () => {
    const { findByText } = renderPage();

    const name = await findByText('Wetland observations');
    fireEvent.click(name.closest('.MuiDataGrid-row')!);

    expect(await findByText('Download detail destination')).toBeVisible();
  });
});
