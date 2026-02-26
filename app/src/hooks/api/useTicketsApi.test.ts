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

    const result = await useTicketsApi(axios).getTickets({ status: 'open', page: 1, limit: 10 });

    expect(result).toEqual(response);
  });

  it('getTicket returns a single ticket', async () => {
    const history = [
      {
        ticket_status_history_id: '33333333-3333-3333-3333-333333333333',
        ticket_id: '11111111-1111-1111-1111-111111111111',
        user_identifier: 'Sarah',
        create_date: '2026-02-25T00:00:00.000Z',
        status: 'open'
      }
    ];

    const ticket = {
      ticket_id: '11111111-1111-1111-1111-111111111111',
      ticket_slug: '04900001',
      title: 'Test ticket',
      description: null,
      team_id: '22222222-2222-2222-2222-222222222222',
      create_date: '2026-02-25T00:00:00.000Z',
      priority: 'medium',
      status: 'open',
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
      create_date: '2026-02-25T00:00:00.000Z',
      priority: 'medium',
      status: 'open'
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
      create_date: '2026-02-25T00:00:00.000Z',
      priority: 'medium',
      status: 'open'
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
      create_date: '2026-02-25T00:00:00.000Z',
      priority: 'medium',
      status: 'closed'
    };

    mock.onPost(`/api/tickets/${ticketId}/status`, { status: 'closed' }).reply(200, ticket);

    const result = await useTicketsApi(axios).updateTicketStatus(ticketId, 'closed');

    expect(result).toEqual(ticket);
  });

  it('createTicketComment posts payload and returns history item', async () => {
    const ticketId = '11111111-1111-1111-1111-111111111111';
    const payload = { comment: 'New comment' };
    const historyItem = {
      ticket_status_history_id: null,
      ticket_comment_id: '33333333-3333-3333-3333-333333333333',
      ticket_id: ticketId,
      user_identifier: 'Sarah',
      create_date: '2026-02-25T00:00:00.000Z',
      status: null,
      comment: 'New comment'
    };

    mock.onPost(`/api/tickets/${ticketId}/comment`, payload).reply(200, historyItem);

    const result = await useTicketsApi(axios).createTicketComment(ticketId, payload);

    expect(result).toEqual(historyItem);
  });

});
