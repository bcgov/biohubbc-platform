import { fireEvent, waitFor } from '@testing-library/react';
import { useApi } from 'hooks/useApi';
import { MemoryRouter } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { TicketsPage } from './TicketsPage';

vi.mock('../../../hooks/useApi');

const mockUseApi = useApi as Mock;

const mockGetTickets = vi.fn();
const mockCreateTicket = vi.fn();

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
      tickets: [],
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

  it('changes page and requests paginated data', async () => {
    const { findByLabelText } = render(
      <MemoryRouter>
        <TicketsPage />
      </MemoryRouter>
    );

    const nextPageButton = await findByLabelText('Go to next page');
    fireEvent.click(nextPageButton);

    await waitFor(() => {
      expect(mockGetTickets).toHaveBeenLastCalledWith({
        page: 2,
        limit: 10,
        sort: 'create_date',
        order: 'desc'
      });
    });
  });

  it('renders empty state message', async () => {
    const { getByTestId } = render(
      <MemoryRouter>
        <TicketsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(getByTestId('tickets-empty-title')).toHaveTextContent('No tickets');
    });
  });
});
