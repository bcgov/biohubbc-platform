import { fireEvent, waitFor } from '@testing-library/react';
import { useApi } from 'hooks/useApi';
import { CodesContext, ICodesContext } from 'contexts/codesContext';
import { DataLoader } from 'hooks/useDataLoader';
import { IGetAllCodeSetsResponse } from 'interfaces/useCodesApi.interface';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { TicketDetailPage } from './TicketDetailPage';

vi.mock('../../../hooks/useApi');

const mockUseApi = useApi as Mock;

const ticket = {
  ticket_id: '11111111-1111-1111-1111-111111111111',
  ticket_slug: '04900042',
  title: 'Test Ticket',
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
  history
};

describe('TicketDetailPage', () => {
  const mockGetTicket = vi.fn();
  const mockGetTeam = vi.fn();
  const mockUpdateTicket = vi.fn();
  const mockUpdateTicketStatus = vi.fn();

  const mockCodesData: IGetAllCodeSetsResponse = {
    feature_type_with_properties: [],
    ticket_priorities: ['low', 'medium', 'high', 'critical']
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
    mockGetTeam.mockResolvedValue({
      team_id: ticket.team_id,
      name: 'Team 1',
      description: null,
      members: [{ team_member_id: 'tm-1', system_user_id: 1, user_identifier: 'alice' }]
    });
    mockUpdateTicket.mockResolvedValue(ticket);
    mockUpdateTicketStatus.mockResolvedValue({ ...ticket, status: 'closed' });

    mockUseApi.mockImplementation(() => ({
      tickets: {
        getTicket: mockGetTicket,
        updateTicket: mockUpdateTicket,
        updateTicketStatus: mockUpdateTicketStatus
      },
      teams: {
        getTeam: mockGetTeam
      }
    }));
  });

  const renderPage = () =>
    render(
      <CodesContext.Provider value={mockCodesContext}>
        <MemoryRouter initialEntries={[`/admin/tickets/${ticket.ticket_id}`]}>
          <Routes>
            <Route path="/admin/tickets/:ticketId" element={<TicketDetailPage />} />
          </Routes>
        </MemoryRouter>
      </CodesContext.Provider>
    );

  it('loads ticket with inline status history on mount', async () => {
    renderPage();

    await waitFor(() => {
      expect(mockGetTicket).toHaveBeenCalledWith(ticket.ticket_id);
      expect(mockGetTeam).toHaveBeenCalledWith(ticket.team_id);
    });
  });

  it('renders timeline and comment input', async () => {
    const { getAllByText, getByText, getByPlaceholderText, getByRole } = renderPage();

    await waitFor(() => {
      expect(getAllByText('Ticket #04900042').length).toBeGreaterThan(0);
      expect(getByText('Sarah opened the ticket')).toBeVisible();
      expect(getByText('Bob closed the ticket')).toBeVisible();
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
      expect(mockUpdateTicketStatus).toHaveBeenCalledWith(ticket.ticket_id, 'closed');
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
        title: 'Updated Subject',
        description: 'Test description',
        priority: 'medium'
      });
    });
  });
});
