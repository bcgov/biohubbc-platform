import { fireEvent, waitFor } from '@testing-library/react';
import { useApi } from 'hooks/useApi';
import { CodesContext, ICodesContext } from 'contexts/codesContext';
import { DialogContextProvider } from 'contexts/dialogContext';
import { TicketContextProvider } from 'contexts/ticketContext';
import { DataLoader } from 'hooks/useDataLoader';
import { IGetAllCodeSetsResponse } from 'interfaces/useCodesApi.interface';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { TicketDetailPage } from './TicketDetailPage';

vi.mock('../../../hooks/useApi');
vi.mock('hooks/useAuthStateContext', () => ({
  useAuthStateContext: () => ({
    biohubUserWrapper: {
      userIdentifier: 'Sarah'
    }
  })
}));
vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');

  return {
    ...actual,
    useParams: () => ({
      ticketId: '11111111-1111-1111-1111-111111111111'
    })
  };
});

const mockUseApi = useApi as Mock;

const ticket = {
  ticket_id: '11111111-1111-1111-1111-111111111111',
  ticket_slug: '04900042',
  subject: 'Test Ticket',
  description: 'Test description',
  team_id: '22222222-2222-2222-2222-222222222222',
  create_date: '2026-02-24T00:00:00.000Z',
  priority: 'medium' as const,
  status: 'open' as const
};

const history = [
  {
    ticket_status_history_id: '33333333-3333-3333-3333-333333333333',
    ticket_id: ticket.ticket_id,
    user_identifier: 'Sarah',
    create_date: '2026-02-24T00:00:00.000Z',
    status: 'open' as const
  },
  {
    ticket_status_history_id: '44444444-4444-4444-4444-444444444444',
    ticket_id: ticket.ticket_id,
    user_identifier: 'Bob',
    create_date: '2026-02-25T00:00:00.000Z',
    status: 'closed' as const
  }
];

const ticketWithHistory = {
  ...ticket,
  statuses: history,
  comments: [],
  references: []
};

describe('TicketDetailPage', () => {
  const mockGetTicket = vi.fn();
  const mockGetTeamMembers = vi.fn();
  const mockGetAvailableUsers = vi.fn();
  const mockCreateTeamMember = vi.fn();
  const mockDeleteTeamMember = vi.fn();
  const mockUpdateTicket = vi.fn();
  const mockUpdateTicketStatus = vi.fn();
  const mockCreateTicketComment = vi.fn();
  const mockCreateTicketReference = vi.fn();

  const mockCodesData: IGetAllCodeSetsResponse = {
    feature_type_with_properties: []
  };

  const mockCodesDataLoader: DataLoader<[], IGetAllCodeSetsResponse, unknown> = {
    data: mockCodesData,
    error: undefined,
    isLoading: false,
    isReady: true,
    load: vi.fn().mockResolvedValue(mockCodesData),
    refresh: vi.fn().mockResolvedValue(mockCodesData),
    clear: vi.fn(),
    setData: vi.fn()
  };

  const mockCodesContext: ICodesContext = {
    codesDataLoader: {
      ...mockCodesDataLoader
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockGetTicket.mockResolvedValue(ticketWithHistory);
    mockGetTeamMembers.mockResolvedValue({
      members: [{ team_member_id: 'tm-1', system_user_id: 1, user_identifier: 'alice' }]
    });
    mockGetAvailableUsers.mockResolvedValue({ users: [] });
    mockCreateTeamMember.mockResolvedValue({ team_member_id: 'tm-2', system_user_id: 2, user_identifier: 'bob' });
    mockDeleteTeamMember.mockResolvedValue(undefined);
    mockUpdateTicket.mockResolvedValue(ticket);
    mockUpdateTicketStatus.mockResolvedValue({ ...ticket, status: 'closed' });
    mockCreateTicketComment.mockResolvedValue({
      ticket_status_history_id: null,
      ticket_comment_id: '55555555-5555-5555-5555-555555555555',
      ticket_id: ticket.ticket_id,
      user_identifier: 'Sarah',
      create_date: '2026-02-25T00:00:00.000Z',
      status: null,
      comment: 'New comment'
    });
    mockCreateTicketReference.mockResolvedValue({
      ticket_reference_id: '66666666-6666-6666-6666-666666666666',
      source_ticket_id: ticket.ticket_id,
      source_ticket_slug: ticket.ticket_slug,
      source_ticket_subject: ticket.subject,
      target_ticket_id: '77777777-7777-7777-7777-777777777777',
      target_ticket_slug: '04900050',
      target_ticket_subject: 'Related ticket',
      relationship: 'relates_to',
      user_identifier: 'Sarah',
      create_date: '2026-02-25T00:00:00.000Z'
    });

    mockUseApi.mockImplementation(() => ({
      tickets: {
        getTicket: mockGetTicket,
        updateTicket: mockUpdateTicket,
        updateTicketStatus: mockUpdateTicketStatus,
        createTicketComment: mockCreateTicketComment,
        createTicketReference: mockCreateTicketReference
      },
      teams: {
        getTeamMembers: mockGetTeamMembers,
        getAvailableUsers: mockGetAvailableUsers,
        createTeamMember: mockCreateTeamMember,
        deleteTeamMember: mockDeleteTeamMember
      }
    }));
  });

  const renderPage = () =>
    render(
      <CodesContext.Provider value={mockCodesContext}>
        <DialogContextProvider>
          <MemoryRouter initialEntries={[`/admin/tickets/${ticket.ticket_id}`]}>
            <Routes>
              <Route
                path="/admin/tickets/:ticketId"
                element={
                  <TicketContextProvider>
                    <TicketDetailPage />
                  </TicketContextProvider>
                }
              />
            </Routes>
          </MemoryRouter>
        </DialogContextProvider>
      </CodesContext.Provider>
    );

  it('loads ticket with inline status history on mount', async () => {
    renderPage();

    await waitFor(() => {
      expect(mockGetTicket).toHaveBeenCalledWith(ticket.ticket_id);
      expect(mockGetTeamMembers).toHaveBeenCalledWith(ticket.team_id);
    });
  });

  it('renders timeline and comment input', async () => {
    const { getAllByText, findByText, findByPlaceholderText, findByRole } = renderPage();

    await waitFor(() => {
      expect(getAllByText('Ticket #04900042').length).toBeGreaterThan(0);
    });

    expect(await findByText(/sarah opened the ticket/i)).toBeVisible();
    expect(await findByText(/bob closed the ticket/i)).toBeVisible();
    expect(await findByText('Assignees')).toBeVisible();
    expect(await findByText(/alice/i)).toBeVisible();
    expect(await findByPlaceholderText('Type your comment...')).toBeVisible();
    expect(await findByRole('link', { name: 'Tickets' })).toHaveAttribute('href', '/admin/tickets');
  });

  it('updates status and refreshes timeline', async () => {
    const { getByTestId } = renderPage();

    await waitFor(() => {
      expect(getByTestId('close-ticket-button')).toBeVisible();
    });

    fireEvent.click(getByTestId('close-ticket-button'));

    await waitFor(() => {
      expect(getByTestId('yes-button')).toBeVisible();
    });

    fireEvent.click(getByTestId('yes-button'));

    await waitFor(() => {
      expect(mockUpdateTicketStatus).toHaveBeenCalledWith(ticket.ticket_id, 'closed');
    });
  });

  it('reopens ticket after confirmation', async () => {
    mockGetTicket.mockResolvedValueOnce({
      ...ticketWithHistory,
      status: 'closed' as const
    });

    const { getByTestId } = renderPage();

    await waitFor(() => {
      expect(getByTestId('open-ticket-button')).toBeVisible();
    });

    fireEvent.click(getByTestId('open-ticket-button'));

    await waitFor(() => {
      expect(getByTestId('yes-button')).toBeVisible();
    });

    fireEvent.click(getByTestId('yes-button'));

    await waitFor(() => {
      expect(mockUpdateTicketStatus).toHaveBeenCalledWith(ticket.ticket_id, 'open');
    });
  });

  it('adds a comment and refreshes timeline', async () => {
    const { getByPlaceholderText, getByRole, getByText } = renderPage();

    await waitFor(() => {
      expect(getByPlaceholderText('Type your comment...')).toBeVisible();
    });

    fireEvent.change(getByPlaceholderText('Type your comment...'), { target: { value: 'New comment' } });
    fireEvent.click(getByRole('button', { name: 'Comment' }));

    await waitFor(() => {
      expect(mockCreateTicketComment).toHaveBeenCalledWith(ticket.ticket_id, { comment: 'New comment' });
      expect(getByText('New comment')).toBeVisible();
    });
  });

  it('hides comment input when ticket is closed', async () => {
    mockGetTicket.mockResolvedValueOnce({ ...ticketWithHistory, status: 'closed' as const });

    const { queryByPlaceholderText } = renderPage();

    await waitFor(() => {
      expect(mockGetTicket).toHaveBeenCalledWith(ticket.ticket_id);
      expect(queryByPlaceholderText('Type your comment...')).not.toBeInTheDocument();
    });
  });

  it('opens edit dialog with current ticket values and submits update', async () => {
    const { getByTestId, getByLabelText } = renderPage();

    await waitFor(() => {
      expect(getByTestId('edit-ticket-button')).toBeVisible();
    });

    fireEvent.click(getByTestId('edit-ticket-button'));

    await waitFor(() => {
      expect(getByLabelText(/Subject/i)).toHaveValue('Test Ticket');
    });

    fireEvent.change(getByLabelText(/Subject/i), { target: { value: 'Updated Subject' } });
    fireEvent.click(getByTestId('edit-dialog-save-button'));

    await waitFor(() => {
      expect(mockUpdateTicket).toHaveBeenCalledWith(ticket.ticket_id, {
        subject: 'Updated Subject',
        description: 'Test description',
        priority: 'medium'
      });
    });
  });
});
