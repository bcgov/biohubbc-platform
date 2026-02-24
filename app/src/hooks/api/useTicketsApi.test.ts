import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { useTicketsApi } from './useTicketsApi';

describe('useTicketsApi', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(axios);
  });

  afterEach(() => {
    mock.restore();
  });

  it('getTickets supports optional filters and pagination', async () => {
    const response = {
      tickets: [],
      pagination: { total: 0, current_page: 1, last_page: 1, per_page: 10 }
    };

    mock.onGet('/api/tickets').reply(200, response);

    const result = await useTicketsApi(axios).getTickets({ status: 'OPEN', page: 1, limit: 10 });

    expect(result).toEqual(response);
  });

  it('getTicket returns a single ticket', async () => {
    const history = [
      {
        ticket_status_history_id: '33333333-3333-3333-3333-333333333333',
        ticket_id: '11111111-1111-1111-1111-111111111111',
        status: 'OPEN'
      }
    ];

    const ticket = {
      ticket_id: '11111111-1111-1111-1111-111111111111',
      ticket_slug: '04900001',
      title: 'Test ticket',
      description: null,
      team_id: '22222222-2222-2222-2222-222222222222',
      priority: 'MEDIUM',
      status: 'OPEN',
      history
    };

    mock.onGet(`/api/tickets/${ticket.ticket_id}`).reply(200, ticket);

    const result = await useTicketsApi(axios).getTicket(ticket.ticket_id);

    expect(result).toEqual(ticket);
  });

  it('createTicket posts payload and returns ticket', async () => {
    const payload = {
      title: 'New ticket',
      description: 'desc'
    };

    const ticket = {
      ticket_id: '11111111-1111-1111-1111-111111111111',
      ticket_slug: '04900001',
      title: 'New ticket',
      description: 'desc',
      team_id: '22222222-2222-2222-2222-222222222222',
      priority: 'MEDIUM',
      status: 'OPEN'
    };

    mock.onPost('/api/tickets', payload).reply(200, ticket);

    const result = await useTicketsApi(axios).createTicket(payload);

    expect(result).toEqual(ticket);
  });

  it('updateTicket patches payload and returns ticket', async () => {
    const ticketId = '11111111-1111-1111-1111-111111111111';
    const payload = { title: 'Updated title' };
    const ticket = {
      ticket_id: ticketId,
      ticket_slug: '04900001',
      title: 'Updated title',
      description: null,
      team_id: '22222222-2222-2222-2222-222222222222',
      priority: 'MEDIUM',
      status: 'OPEN'
    };

    mock.onPatch(`/api/tickets/${ticketId}`, payload).reply(200, ticket);

    const result = await useTicketsApi(axios).updateTicket(ticketId, payload);

    expect(result).toEqual(ticket);
  });

  it('updateTicketStatus posts to /status endpoint', async () => {
    const ticketId = '11111111-1111-1111-1111-111111111111';
    const ticket = {
      ticket_id: ticketId,
      ticket_slug: '04900001',
      title: 'Status changed',
      description: null,
      team_id: '22222222-2222-2222-2222-222222222222',
      priority: 'MEDIUM',
      status: 'CLOSED'
    };

    mock.onPost(`/api/tickets/${ticketId}/status`, { status: 'CLOSED' }).reply(200, ticket);

    const result = await useTicketsApi(axios).updateTicketStatus(ticketId, 'CLOSED');

    expect(result).toEqual(ticket);
  });

});
