import { useApi } from 'hooks/useApi';
import { IGetTicketsResponse, ITicket } from 'interfaces/useTicketsApi.interface';
import { ComponentProps } from 'react';
import { ticketQueryKeys } from 'utils/query-keys/ticket-query-keys';
import { CreateTicketDialog } from './components/dialog/create/CreateTicketDialog';
import { EditTicketDialog } from './components/dialog/edit/EditTicketDialog';
import { MemoryRouter } from 'react-router-dom';
import { createTestQueryClient } from 'test-helpers/query-client';
import { act, fireEvent, render, screen, waitFor, within } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { TicketsPage } from './TicketsPage';

vi.mock('../../../hooks/useApi');

const dialogs = vi.hoisted(() => ({ create: vi.fn(), edit: vi.fn() }));
vi.mock('./components/dialog/create/CreateTicketDialog', () => ({ CreateTicketDialog: dialogs.create }));
vi.mock('./components/dialog/edit/EditTicketDialog', () => ({ EditTicketDialog: dialogs.edit }));

const mockUseApi = useApi as Mock;

const mockGetTickets = vi.fn();
const mockCreateTicket = vi.fn();
const mockUpdateTicketStatus = vi.fn();
const mockUpdateTicket = vi.fn();
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
    updateTicketStatus: mockUpdateTicketStatus,
    updateTicket: mockUpdateTicket
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
    dialogs.create.mockReturnValue(null);
    dialogs.edit.mockReturnValue(null);
    mockUseApi.mockImplementation(() => apiMock);

    mockGetTickets.mockResolvedValue({
      tickets: [sampleTicket],
      pagination: { total: 25, current_page: 1, last_page: 3, per_page: 10 }
    });
  });

  it.each([
    ['create', false],
    ['edit', false],
    ['create', true],
    ['edit', true]
  ] as const)(
    'keeps a saved %s when an older list response arrives (concurrent status toggle: %s)',
    async (operation, concurrentToggle) => {
      const queryClient = createTestQueryClient();
      const queryKey = ticketQueryKeys.list('admin', {
        search: '',
        page: 1,
        limit: 10,
        sort: 'create_date',
        order: 'desc'
      });
      const original: IGetTicketsResponse = {
        tickets: [sampleTicket],
        pagination: { total: 1, current_page: 1, last_page: 1, per_page: 10 }
      };
      queryClient.setQueryData(queryKey, original);
      const saved: ITicket = {
        ...sampleTicket,
        ticket_id: operation === 'create' ? 'new-ticket' : sampleTicket.ticket_id,
        subject: 'Saved ticket'
      };
      let finishSave!: (ticket: ITicket) => void;
      const saving = new Promise<ITicket>((resolve) => {
        finishSave = resolve;
      });
      mockCreateTicket.mockReturnValue(saving);
      mockUpdateTicket.mockReturnValue(saving);
      let finishToggle!: (ticket: ITicket) => void;
      mockUpdateTicketStatus.mockReturnValue(
        new Promise<ITicket>((resolve) => {
          finishToggle = resolve;
        })
      );
      const reconciled: IGetTicketsResponse = {
        ...original,
        tickets:
          operation === 'create'
            ? [saved, { ...sampleTicket, status: concurrentToggle ? 'closed' : 'open' }]
            : [{ ...saved, status: concurrentToggle ? 'closed' : 'open' }],
        pagination: { ...original.pagination, total: operation === 'create' ? 2 : 1 }
      };
      let finishRead!: (response: IGetTicketsResponse) => void;
      mockGetTickets
        .mockReturnValueOnce(
          new Promise<IGetTicketsResponse>((resolve) => {
            finishRead = resolve;
          })
        )
        .mockResolvedValue(reconciled);
      render(
        <MemoryRouter>
          <TicketsPage />
        </MemoryRouter>,
        { queryClient }
      );

      if (operation === 'create') {
        const props = dialogs.create.mock.lastCall![0] as ComponentProps<typeof CreateTicketDialog>;
        act(() => props.onSave({ subject: saved.subject, description: null, priority: saved.priority }));
      } else {
        await toggleFirstTicket('Editticket');
        const props = dialogs.edit.mock.lastCall![0] as ComponentProps<typeof EditTicketDialog>;
        act(() => props.onSubmit({ subject: saved.subject, description: null, priority: saved.priority }));
      }
      await waitFor(() =>
        expect(operation === 'create' ? mockCreateTicket : mockUpdateTicket).toHaveBeenCalledTimes(1)
      );
      if (concurrentToggle) {
        await toggleFirstTicket('Closeticket');
        await waitFor(() => expect(mockUpdateTicketStatus).toHaveBeenCalledTimes(1));
      }
      // A read can start during a save (for example, returning to this cached page).
      act(() => {
        void queryClient.invalidateQueries({ queryKey });
      });
      await waitFor(() => expect(mockGetTickets).toHaveBeenCalledTimes(1));
      await act(async () => finishSave(saved));
      await waitFor(() => expect(queryClient.isFetching({ queryKey })).toBe(0));
      if (concurrentToggle) {
        expect(mockGetTickets).toHaveBeenCalledTimes(1);
      }
      await act(async () => finishRead(original));
      if (concurrentToggle) {
        expect(
          queryClient
            .getQueryData<IGetTicketsResponse>(queryKey)
            ?.tickets.find((row) => row.ticket_id === sampleTicket.ticket_id)?.status
        ).toBe('closed');
        await act(async () => finishToggle({ ...sampleTicket, status: 'closed' }));
      }
      await waitFor(() => expect(mockGetTickets).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(queryClient.getQueryData(queryKey)).toEqual(reconciled));
    }
  );

  it.each(['create', 'edit'] as const)('uses server filtering and counts after %s', async (operation) => {
    const queryClient = createTestQueryClient();
    const queryKey = ticketQueryKeys.list('admin', {
      search: 'Sample',
      page: 1,
      limit: 10,
      sort: 'create_date',
      order: 'desc'
    });
    render(
      <MemoryRouter>
        <TicketsPage />
      </MemoryRouter>,
      { queryClient }
    );
    await screen.findByText('Sample ticket');
    fireEvent.change(screen.getByPlaceholderText('Search by ticket subject'), { target: { value: 'Sample' } });
    await waitFor(() =>
      expect(mockGetTickets).toHaveBeenCalledWith(
        { search: 'Sample', page: 1, limit: 10, sort: 'create_date', order: 'desc' },
        { signal: expect.any(AbortSignal) }
      )
    );
    await waitFor(() => expect(queryClient.isFetching({ queryKey })).toBe(0));
    const saved = {
      ...sampleTicket,
      ticket_id: operation === 'create' ? 'new-ticket' : sampleTicket.ticket_id,
      subject: 'Different subject'
    };
    const refreshed: IGetTicketsResponse = {
      tickets: operation === 'create' ? [sampleTicket] : [],
      pagination: { total: operation === 'create' ? 1 : 0, current_page: 1, last_page: 1, per_page: 10 }
    };
    mockGetTickets.mockResolvedValue(refreshed);
    mockCreateTicket.mockResolvedValue(saved);
    mockUpdateTicket.mockResolvedValue(saved);
    const readsBeforeSave = mockGetTickets.mock.calls.length;
    if (operation === 'create') {
      const props = dialogs.create.mock.lastCall![0] as ComponentProps<typeof CreateTicketDialog>;
      act(() => props.onSave({ subject: saved.subject, description: null, priority: saved.priority }));
    } else {
      await toggleFirstTicket('Editticket');
      const props = dialogs.edit.mock.lastCall![0] as ComponentProps<typeof EditTicketDialog>;
      act(() => props.onSubmit({ subject: saved.subject, description: null, priority: saved.priority }));
    }
    await waitFor(() => expect(mockGetTickets).toHaveBeenCalledTimes(readsBeforeSave + 1));
    await waitFor(() => expect(queryClient.getQueryData(queryKey)).toEqual(refreshed));
    expect(screen.getByPlaceholderText('Search by ticket subject')).toHaveValue('Sample');
    expect(screen.queryByText('Different subject')).not.toBeInTheDocument();
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

  it('invalidates other cached list views after a status change without reloading the current grid', async () => {
    const queryClient = createTestQueryClient();
    const otherList = ticketQueryKeys.list('admin', { search: 'Sample', page: 1, limit: 10 });
    queryClient.setQueryData(otherList, { tickets: [sampleTicket] });
    mockUpdateTicketStatus.mockResolvedValue({ ...sampleTicket, status: 'closed' });
    render(
      <MemoryRouter>
        <TicketsPage />
      </MemoryRouter>,
      { queryClient }
    );
    await toggleFirstTicket('Closeticket');
    await waitFor(() => expect(queryClient.getQueryData(otherList)).toBeUndefined());
    expect(mockGetTickets).toHaveBeenCalledOnce();
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
