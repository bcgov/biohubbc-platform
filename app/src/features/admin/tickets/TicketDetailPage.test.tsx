import { fireEvent, waitFor } from '@testing-library/react';
import { useApi } from 'hooks/useApi';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { TicketDetailPage } from './TicketDetailPage';

vi.mock('../../../hooks/useApi');

const mockUseApi = useApi as Mock;

const ticket = {
  ticket_id: '11111111-1111-1111-1111-111111111111',
  ticket_number: 42,
  ticket_short_id: '04900042',
  title: 'Test Ticket',
  description: 'Test description',
  team_id: '22222222-2222-2222-2222-222222222222',
  priority: 'MEDIUM' as const,
  status: 'OPEN' as const
};

const history = [
  {
    ticket_status_history_id: '33333333-3333-3333-3333-333333333333',
    ticket_id: ticket.ticket_id,
    status: 'OPEN' as const
  },
  {
    ticket_status_history_id: '44444444-4444-4444-4444-444444444444',
    ticket_id: ticket.ticket_id,
    status: 'CLOSED' as const
  }
];

const ticketWithHistory = {
  ...ticket,
  history
};

describe('TicketDetailPage', () => {
  const mockGetTicket = vi.fn();
  const mockGetTeam = vi.fn();
  const mockUpdateTicketStatus = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    mockGetTicket.mockResolvedValue(ticketWithHistory);
    mockGetTeam.mockResolvedValue({
      team_id: ticket.team_id,
      name: 'Team 1',
      description: null,
      members: [{ team_member_id: 'tm-1', system_user_id: 1, user_identifier: 'alice' }]
    });
    mockUpdateTicketStatus.mockResolvedValue({ ...ticket, status: 'CLOSED' });

    mockUseApi.mockImplementation(() => ({
      tickets: {
        getTicket: mockGetTicket,
        updateTicketStatus: mockUpdateTicketStatus
      },
      teams: {
        getTeam: mockGetTeam
      }
    }));
  });

  const renderPage = () =>
    render(
      <MemoryRouter initialEntries={[`/admin/tickets/${ticket.ticket_short_id}`]}>
        <Routes>
          <Route path="/admin/tickets/:ticketId" element={<TicketDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

  it('loads ticket with inline status history on mount', async () => {
    renderPage();

    await waitFor(() => {
      expect(mockGetTicket).toHaveBeenCalledWith(ticket.ticket_short_id);
      expect(mockGetTeam).toHaveBeenCalledWith(ticket.team_id);
    });
  });

  it('renders timeline and comment input', async () => {
    const { getByText, getByPlaceholderText, getByRole } = renderPage();

    await waitFor(() => {
      expect(getByText('Ticket #04900042')).toBeVisible();
      expect(getByText('Ticket was opened')).toBeVisible();
      expect(getByText('Ticket was closed')).toBeVisible();
      expect(getByText('Team')).toBeVisible();
      expect(getByText('alice')).toBeVisible();
      expect(getByPlaceholderText('Type your comment...')).toBeVisible();
      expect(getByRole('link', { name: 'Tickets' })).toHaveAttribute('href', '/admin/tickets');
    });
  });

  it('updates status and refreshes timeline', async () => {
    const { getByTestId } = renderPage();

    await waitFor(() => {
      expect(getByTestId('close-ticket-button')).toBeVisible();
    });

    fireEvent.click(getByTestId('close-ticket-button'));

    await waitFor(() => {
      expect(mockUpdateTicketStatus).toHaveBeenCalledWith(ticket.ticket_short_id, 'CLOSED');
    });
  });
});
