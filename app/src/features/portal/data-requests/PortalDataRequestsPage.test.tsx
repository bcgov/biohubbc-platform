import { waitFor } from '@testing-library/react';
import { DATE_FORMAT } from 'constants/dateTimeFormats';
import { DataRequestResponse } from 'interfaces/useDataRequestApi.interface';
import { PolicyStatus } from 'interfaces/usePoliciesApi.interface';
import { MemoryRouter } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { getFormattedDate } from 'utils/Utils';
import { PortalDataRequestsPage } from './PortalDataRequestsPage';

const mockGetDataRequestsForUser = vi.fn();

vi.mock('hooks/useApi', () => ({
  useApi: () => ({
    dataRequest: { getDataRequestsForUser: mockGetDataRequestsForUser }
  })
}));

const dataRequest: DataRequestResponse = {
  data_request_id: '11111111-2222-3333-4444-555555555555',
  reason: 'Caribou telemetry for range planning',
  team_id: 'team-1',
  requested_by: 42,
  ticket_id: 'ticket-1',
  policy_id: 'policy-1',
  status: PolicyStatus.APPROVED,
  create_date: '2026-08-30T12:00:00Z'
};

/**
 * Render the Portal data requests page.
 *
 * @return {ReturnType<typeof render>} Testing Library utilities for the rendered page.
 */
const renderPage = (): ReturnType<typeof render> =>
  render(
    <MemoryRouter initialEntries={['/portal/data-request']}>
      <PortalDataRequestsPage />
    </MemoryRouter>
  );

describe('PortalDataRequestsPage', () => {
  beforeEach(() => {
    mockGetDataRequestsForUser.mockReset();
  });

  it("lists the data requests of the current user's teams with their decision and date", async () => {
    mockGetDataRequestsForUser.mockResolvedValue({
      data_requests: [dataRequest],
      pagination: { total: 1, current_page: 1, last_page: 1, per_page: 10 }
    });

    const { findByText, getByText, getByRole } = renderPage();

    expect(await findByText('Caribou telemetry for range planning')).toBeVisible();
    expect(getByText('Approved')).toBeVisible();
    expect(getByText(getFormattedDate(DATE_FORMAT.ShortMediumDateFormat, dataRequest.create_date))).toBeVisible();
    expect(getByRole('link', { name: 'Portal' })).toHaveAttribute('href', '/portal');
  });

  it('requests the first page newest first and shows the total from the server', async () => {
    mockGetDataRequestsForUser.mockResolvedValue({
      data_requests: [dataRequest],
      pagination: { total: 37, current_page: 1, last_page: 4, per_page: 10 }
    });

    const { findByText } = renderPage();

    expect(await findByText('(37)')).toBeVisible();
    await waitFor(() => {
      expect(mockGetDataRequestsForUser).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, sort: 'create_date', order: 'desc' }),
        { signal: expect.any(AbortSignal) }
      );
    });
  });

  it('shows an empty state when the teams have no data requests', async () => {
    mockGetDataRequestsForUser.mockResolvedValue({
      data_requests: [],
      pagination: { total: 0, current_page: 1, last_page: 1, per_page: 10 }
    });

    const { findByText } = renderPage();

    expect(await findByText('No data requests')).toBeVisible();
  });
});
