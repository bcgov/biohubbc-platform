import { waitFor } from '@testing-library/react';
import { useApi } from 'hooks/useApi';
import { MemoryRouter } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { TicketsPage } from './TicketsPage';

vi.mock('../../../hooks/useApi');

const mockUseApi = useApi as Mock;

const mockGetTickets = vi.fn();
const mockCreateTicket = vi.fn();
const sampleTicket = {
  ticket_id: '11111111-1111-1111-1111-111111111111',
  ticket_slug: '04900001',
  subject: 'Sample ticket',
  description: null,
  team_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  create_date: '2026-03-01T00:00:00.000Z',
  priority: 'medium' as const,
  status: 'open' as const
};

const apiMock = {
  tickets: {
    getTickets: mockGetTickets,
    createTicket: mockCreateTicket
  }
};

describe('TicketsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseApi.mockImplementation(() => apiMock);

    mockGetTickets.mockResolvedValue({
      tickets: [sampleTicket],
      pagination: { total: 25, current_page: 1, last_page: 3, per_page: 10 }
    });
  });

  it('fetches all tickets by default with create_date desc', async () => {
    render(
      <MemoryRouter>
        <TicketsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockGetTickets).toHaveBeenCalledWith({
        search: '',
        page: 1,
        limit: 10,
        sort: 'create_date',
        order: 'desc'
      });
    });
  });

  it('renders only Tickets in the administrative tabs', async () => {
    const { getByRole, queryByRole } = render(
      <MemoryRouter>
        <TicketsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockGetTickets).toHaveBeenCalledTimes(1);
    });

    expect(getByRole('tab', { name: 'Tickets' })).toBeVisible();
    expect(queryByRole('tab', { name: 'Uploads' })).toBeNull();
    expect(queryByRole('tab', { name: 'Requests' })).toBeNull();
  });

  it('renders server pagination controls', async () => {
    const { findByText } = render(
      <MemoryRouter>
        <TicketsPage />
      </MemoryRouter>
    );

    expect(await findByText('Rows per page:')).toBeInTheDocument();
  });

  it('renders empty state message', async () => {
    mockGetTickets.mockResolvedValueOnce({
      tickets: [],
      pagination: { total: 0, current_page: 1, last_page: 1, per_page: 10 }
    });

    const { findByText } = render(
      <MemoryRouter>
        <TicketsPage />
      </MemoryRouter>
    );

    expect(await findByText('No tickets')).toBeVisible();
  });
});
