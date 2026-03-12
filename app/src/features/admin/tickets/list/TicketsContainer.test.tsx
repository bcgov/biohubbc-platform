import { fireEvent, waitFor } from '@testing-library/react';
import { useApi } from 'hooks/useApi';
import { IGetTicketsResponse, ITicket } from 'interfaces/useTicketsApi.interface';
import { render } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { TicketsContainer } from './TicketsContainer';

vi.mock('hooks/useApi');

describe('TicketsContainer', () => {
  const mockUseApi = useApi as Mock;
  const updateTicketStatus = vi.fn();

  const tickets: ITicket[] = [
    {
      ticket_id: '11111111-1111-1111-1111-111111111111',
      ticket_slug: '04900001',
      subject: 'Open ticket',
      description: null,
      team_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      create_date: '2026-03-01T00:00:00.000Z',
      priority: 'medium',
      status: 'open'
    },
    {
      ticket_id: '22222222-2222-2222-2222-222222222222',
      ticket_slug: '04900002',
      subject: 'Closed ticket',
      description: null,
      team_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      create_date: '2026-03-01T00:00:00.000Z',
      priority: 'medium',
      status: 'closed'
    }
  ];

  const response: IGetTicketsResponse = {
    tickets,
    pagination: {
      total: 2,
      current_page: 1,
      last_page: 1,
      per_page: 10,
      sort: 'create_date',
      order: 'desc'
    }
  };

  const renderList = () => {
    mockUseApi.mockReturnValue({
      tickets: {
        updateTicketStatus,
        createTicket: vi.fn(),
        deleteTicket: vi.fn()
      }
    });

    return render(
      <TicketsContainer
        response={response}
        rows={tickets}
        rowCount={2}
        paginationModel={{ page: 0, pageSize: 10 }}
        setPaginationModel={vi.fn()}
        sortModel={[{ field: 'create_date', sort: 'desc' }]}
        setSortModel={vi.fn()}
        searchTerm=""
        onSearch={vi.fn()}
        refresh={vi.fn()}
        setData={vi.fn()}
        onRowClick={vi.fn()}
      />
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    updateTicketStatus.mockResolvedValue({ ...tickets[0], status: 'closed' });
  });

  it('shows close action for open tickets', async () => {
    const { getAllByTestId, getByTestId } = renderList();

    fireEvent.click(getAllByTestId('custom-menu-icon-Actions')[0]);

    await waitFor(() => {
      expect(getByTestId('custom-menu-icon-item-Closeticket')).toBeVisible();
    });

    fireEvent.click(getByTestId('custom-menu-icon-item-Closeticket'));

    await waitFor(() => {
      expect(updateTicketStatus).toHaveBeenCalledWith(tickets[0].ticket_id, 'closed');
    });
  });

  it('shows reopen action for closed tickets', async () => {
    updateTicketStatus.mockResolvedValue({ ...tickets[1], status: 'open' });
    const { getAllByTestId, getByTestId } = renderList();

    fireEvent.click(getAllByTestId('custom-menu-icon-Actions')[1]);

    await waitFor(() => {
      expect(getByTestId('custom-menu-icon-item-Reopenticket')).toBeVisible();
    });

    fireEvent.click(getByTestId('custom-menu-icon-item-Reopenticket'));

    await waitFor(() => {
      expect(updateTicketStatus).toHaveBeenCalledWith(tickets[1].ticket_id, 'open');
    });
  });
});
