import { useApi } from 'hooks/useApi';
import { MemoryRouter } from 'react-router-dom';
import { createTestQueryClient } from 'test-helpers/query-client';
import { act, fireEvent, render, screen, waitFor, within } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { TicketsPage } from './TicketsPage';

vi.mock('../../../hooks/useApi');

const mockUseApi = useApi as Mock;

const mockGetTickets = vi.fn();
const mockCreateTicket = vi.fn();
const mockUpdateTicketStatus = vi.fn();
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
    getTicketsForAdmin: mockGetTickets,
    createTicket: mockCreateTicket,
    updateTicketStatus: mockUpdateTicketStatus
  }
};

/**
 * Opens the first row's actions menu and picks a status action.
 *
 * @param {string} action The menu item's test id suffix, such as `Closeticket`.
 * @returns {Promise<void>} Resolves once the action has been clicked.
 */
const toggleFirstTicket = async (action: string) => {
  fireEvent.click((await screen.findAllByTestId('custom-menu-icon-Actions'))[0]);
  fireEvent.click(await screen.findByTestId(`custom-menu-icon-item-${action}`));
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
      expect(mockGetTickets).toHaveBeenCalledWith(
        { search: '', page: 1, limit: 10, sort: 'create_date', order: 'desc' },
        { signal: expect.any(AbortSignal) }
      );
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

  it("keeps a row's latest status when an earlier toggle's response arrives last, and drops the ticket's cached details", async () => {
    const responses: Record<string, (value: unknown) => void> = {};
    mockUpdateTicketStatus.mockImplementation(
      (_ticketId: string, status: string) => new Promise((done) => (responses[status] = done))
    );
    const queryClient = createTestQueryClient();
    const cachedDetails = [
      ['ticket', 'admin', 'detail', sampleTicket.ticket_id],
      ['ticket', 'user', 'detail', sampleTicket.ticket_id]
    ];
    cachedDetails.forEach((key) => queryClient.setQueryData(key, sampleTicket));
    render(
      <MemoryRouter>
        <TicketsPage />
      </MemoryRouter>,
      { queryClient }
    );

    await toggleFirstTicket('Closeticket');
    await toggleFirstTicket('Reopenticket');
    await waitFor(() => expect(mockUpdateTicketStatus).toHaveBeenCalledTimes(2));

    await act(async () => responses.open({ ...sampleTicket, status: 'open' }));
    await act(async () => responses.closed({ ...sampleTicket, status: 'closed' }));

    const row = screen.getByText('#04900001').closest('[role="row"]') as HTMLElement;
    expect(within(row).getByText('open')).toBeVisible();
    expect(cachedDetails.map((key) => queryClient.getQueryData(key))).toEqual([undefined, undefined]);
  });
});
