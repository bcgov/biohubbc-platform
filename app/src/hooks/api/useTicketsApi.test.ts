import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { ITicketCommentLog, ITicketReference, ITicketStatusLog } from 'interfaces/useTicketsApi.interface';
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

    mock.onGet('/api/administrative/tickets').reply(200, response);

    const result = await useTicketsApi(axios).getTicketsForAdmin({ status: 'open', page: 1, limit: 10 });

    expect(result).toEqual(response);
  });

  it('getTicket returns ticket with statuses', async () => {
    const statuses: ITicketStatusLog[] = [
      {
        ticket_status_history_id: '33333333-3333-3333-3333-333333333333',
        ticket_id: '11111111-1111-1111-1111-111111111111',
        user_identifier: 'Sarah',
        create_date: '2026-02-25T00:00:00.000Z',
        status: 'open'
      }
    ];
    const comments: ITicketCommentLog[] = [];
    const references: ITicketReference[] = [];

    const apiTicket = {
      ticket_id: '11111111-1111-1111-1111-111111111111',
      ticket_slug: '04900001',
      subject: 'Test ticket',
      description: null,
      team_id: '22222222-2222-2222-2222-222222222222',
      create_date: '2026-02-25T00:00:00.000Z',
      priority: 'medium',
      status: 'open',
      statuses,
      comments,
      references
    };

    mock.onGet(`/api/administrative/tickets/${apiTicket.ticket_id}`).reply(200, apiTicket);

    const result = await useTicketsApi(axios).getTicketForAdmin(apiTicket.ticket_id);

    expect(result).toEqual(apiTicket);
  });

  it('createTicket posts payload and returns ticket', async () => {
    const payload = {
      subject: 'New ticket',
      description: 'desc',
      priority: 'medium' as const
    };

    const ticket = {
      ticket_id: '11111111-1111-1111-1111-111111111111',
      ticket_slug: '04900001',
      subject: 'New ticket',
      description: 'desc',
      team_id: '22222222-2222-2222-2222-222222222222',
      create_date: '2026-02-25T00:00:00.000Z',
      priority: 'medium',
      status: 'open'
    };

    mock.onPost('/api/administrative/tickets', payload).reply(200, ticket);

    const result = await useTicketsApi(axios).createTicket(payload);

    expect(result).toEqual(ticket);
  });

  it('updateTicket puts payload and returns ticket', async () => {
    const ticketId = '11111111-1111-1111-1111-111111111111';
    const payload = { subject: 'Updated subject' };
    const ticket = {
      ticket_id: ticketId,
      ticket_slug: '04900001',
      subject: 'Updated subject',
      description: null,
      team_id: '22222222-2222-2222-2222-222222222222',
      create_date: '2026-02-25T00:00:00.000Z',
      priority: 'medium',
      status: 'open'
    };

    mock.onPut(`/api/administrative/tickets/${ticketId}`, payload).reply(200, ticket);

    const result = await useTicketsApi(axios).updateTicket(ticketId, payload);

    expect(result).toEqual(ticket);
  });

  it('deleteTicket calls delete endpoint', async () => {
    const ticketId = '11111111-1111-1111-1111-111111111111';

    mock.onDelete(`/api/administrative/tickets/${ticketId}`).reply(204);

    await expect(useTicketsApi(axios).deleteTicket(ticketId)).resolves.toBeUndefined();
  });

  it('updateTicketStatus puts to /status endpoint', async () => {
    const ticketId = '11111111-1111-1111-1111-111111111111';
    const ticket = {
      ticket_id: ticketId,
      ticket_slug: '04900001',
      subject: 'Status changed',
      description: null,
      team_id: '22222222-2222-2222-2222-222222222222',
      create_date: '2026-02-25T00:00:00.000Z',
      priority: 'medium',
      status: 'closed'
    };

    mock.onPut(`/api/administrative/tickets/${ticketId}/status`, { status: 'closed' }).reply(200, ticket);

    const result = await useTicketsApi(axios).updateTicketStatus(ticketId, 'closed');

    expect(result).toEqual(ticket);
  });

  it('createTicketComment posts payload and returns comment row', async () => {
    const ticketId = '11111111-1111-1111-1111-111111111111';
    const payload = { comment: 'New comment' };
    const commentItem = {
      ticket_comment_id: '33333333-3333-3333-3333-333333333333',
      ticket_id: ticketId,
      user_identifier: 'Sarah',
      create_date: '2026-02-25T00:00:00.000Z',
      comment: 'New comment'
    };

    mock.onPost(`/api/administrative/tickets/${ticketId}/comment`, payload).reply(200, commentItem);

    const result = await useTicketsApi(axios).createTicketComment(ticketId, payload);

    expect(result).toEqual(commentItem);
  });

  it('createTicketReference posts payload and returns reference row', async () => {
    const ticketId = '11111111-1111-1111-1111-111111111111';
    const payload = {
      references: [
        {
          target_ticket_id: '22222222-2222-2222-2222-222222222222',
          relationship: 'relates_to' as const
        },
        {
          target_ticket_id: '33333333-3333-3333-3333-333333333333',
          relationship: 'relates_to' as const
        }
      ]
    };
    const referenceItems = [
      {
        ticket_reference_id: '44444444-4444-4444-4444-444444444444',
        source_ticket_id: ticketId,
        source_ticket_slug: '04900001',
        source_ticket_subject: 'Source ticket',
        target_ticket_id: payload.references[0].target_ticket_id,
        target_ticket_slug: '04900002',
        target_ticket_subject: 'Target ticket A',
        relationship: payload.references[0].relationship,
        user_identifier: 'Sarah',
        create_date: '2026-02-25T00:00:00.000Z'
      },
      {
        ticket_reference_id: '55555555-5555-5555-5555-555555555555',
        source_ticket_id: ticketId,
        source_ticket_slug: '04900001',
        source_ticket_subject: 'Source ticket',
        target_ticket_id: payload.references[1].target_ticket_id,
        target_ticket_slug: '04900003',
        target_ticket_subject: 'Target ticket B',
        relationship: payload.references[1].relationship,
        user_identifier: 'Sarah',
        create_date: '2026-02-25T00:00:00.000Z'
      }
    ];

    mock.onPost(`/api/administrative/tickets/${ticketId}/reference`, payload).reply(201, referenceItems);

    const result = await useTicketsApi(axios).createTicketReference(ticketId, payload);

    expect(result).toEqual(referenceItems);
  });

  it('deleteTicketReference calls delete endpoint', async () => {
    const ticketId = '11111111-1111-1111-1111-111111111111';
    const ticketReferenceId = '33333333-3333-3333-3333-333333333333';

    mock.onDelete(`/api/administrative/tickets/${ticketId}/reference/${ticketReferenceId}`).reply(204);

    await expect(useTicketsApi(axios).deleteTicketReference(ticketId, ticketReferenceId)).resolves.toBeUndefined();
  });
});
