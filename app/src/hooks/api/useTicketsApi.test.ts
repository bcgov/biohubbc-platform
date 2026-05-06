import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import {
  ICompleteTicketUploadRequest,
  ICreateTicketCommentRequest,
  ICreateTicketReferenceRequest,
  ICreateTicketRequest,
  ICreateTicketSystemUser,
  ICreateTicketUploadRequest,
  ICreateTicketUploadResponse,
  IGetTicketsResponse,
  ITicket,
  ITicketArtifact,
  ITicketArtifactDownloadResponse,
  ITicketCommentLog,
  ITicketExtended,
  ITicketReference,
  ITicketStatusLog,
  ITicketSystemUser,
  TicketSubmissionUploadReviewResponse,
  IUpdateTicketRequest,
  IUpdateTicketSystemUserStatusRequest
} from 'interfaces/useTicketsApi.interface';
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
    const response: IGetTicketsResponse = {
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
        ticket_status_id: '33333333-3333-3333-3333-333333333333',
        ticket_id: '11111111-1111-1111-1111-111111111111',
        user_identifier: 'Sarah',
        create_date: '2026-02-25T00:00:00.000Z',
        status: 'open'
      }
    ];
    const comments: ITicketCommentLog[] = [];
    const references: ITicketReference[] = [];

    const apiTicket: ITicketExtended = {
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
      artifacts: [],
      references,
      data_requests: [],
      submission_uploads: [],
      ticket_system_users: []
    };

    mock.onGet(`/api/administrative/tickets/${apiTicket.ticket_id}`).reply(200, apiTicket);

    const result = await useTicketsApi(axios).getTicketForAdmin(apiTicket.ticket_id);

    expect(result).toEqual(apiTicket);
  });

  it('createTicket posts payload and returns ticket', async () => {
    const payload: ICreateTicketRequest = {
      subject: 'New ticket',
      description: 'desc',
      priority: 'medium'
    };

    const ticket: ITicket = {
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
    const payload: IUpdateTicketRequest = { subject: 'Updated subject' };
    const ticket: ITicket = {
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
    const ticket: ITicket = {
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
    const payload: ICreateTicketCommentRequest = { comment: 'New comment' };
    const commentItem: ITicketCommentLog = {
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

  it('createTicketUpload posts payload and returns upload initialization response', async () => {
    const ticketId = '11111111-1111-1111-1111-111111111111';
    const payload: ICreateTicketUploadRequest = { file_name: 'notes.txt', byte_size: 12, content_type: 'text/plain' };
    const response: ICreateTicketUploadResponse = {
      upload_id: '33333333-3333-3333-3333-333333333333',
      presigned_upload_url: 'https://example.com/presigned'
    };

    mock.onPost(`/api/administrative/tickets/${ticketId}/upload`, payload).reply(201, response);

    const result = await useTicketsApi(axios).createTicketUpload(ticketId, payload);

    expect(result).toEqual(response);
  });

  it('completeTicketUpload puts payload to upload completion endpoint', async () => {
    const ticketId = '11111111-1111-1111-1111-111111111111';
    const uploadId = '33333333-3333-3333-3333-333333333333';
    const payload: ICompleteTicketUploadRequest = { status: 'uploaded' };
    const response: ITicketArtifact = {
      ticket_artifact_id: '44444444-4444-4444-8444-444444444444',
      ticket_id: ticketId,
      artifact_id: '55555555-5555-4555-8555-555555555555',
      record_end_date: null,
      create_date: '2026-02-25T00:00:00.000Z',
      key: 'tickets/notes.txt'
    };

    mock.onPut(`/api/administrative/tickets/${ticketId}/upload/${uploadId}`, payload).reply(200, response);

    await expect(useTicketsApi(axios).completeTicketUpload(ticketId, uploadId, payload)).resolves.toEqual(response);
  });

  it('getTicketArtifactDownloadUrl fetches a presigned ticket attachment URL', async () => {
    const ticketId = '11111111-1111-1111-1111-111111111111';
    const ticketArtifactId = '33333333-3333-4333-9333-333333333333';
    const response: ITicketArtifactDownloadResponse = { signed_url: 'https://example.com/download' };

    mock.onGet(`/api/tickets/${ticketId}/artifact/${ticketArtifactId}`).reply(200, response);

    const result = await useTicketsApi(axios).getTicketArtifactDownloadUrl(ticketId, ticketArtifactId);

    expect(result).toEqual(response);
  });

  it('updateSubmissionUploadReviewStatus patches the final upload disposition endpoint', async () => {
    const submissionUuid = '11111111-1111-1111-1111-111111111111';
    const submissionUploadId = '22222222-2222-4222-8222-222222222222';
    const payload = { status: 'approved' as const };

    mock
      .onPatch(`/api/administrative/submission/${submissionUuid}/upload/${submissionUploadId}/status`, payload)
      .reply(204);

    await expect(
      useTicketsApi(axios).updateSubmissionUploadReviewStatus(submissionUuid, submissionUploadId, payload)
    ).resolves.toBeUndefined();
  });

  it('insertSubmissionUploadReview posts a scoped upload review task', async () => {
    const submissionUploadId = '22222222-2222-4222-8222-222222222222';
    const payload = { scope: 'security' as const };
    const response: TicketSubmissionUploadReviewResponse = {
      submission_upload_review_id: '11111111-1111-4111-8111-111111111111',
      submission_upload_id: submissionUploadId,
      scope: 'security',
      status: 'requested',
      requested_by: 7
    };

    mock.onPost(`/api/administrative/submission-upload/${submissionUploadId}/review`, payload).reply(200, response);

    const result = await useTicketsApi(axios).insertSubmissionUploadReview(submissionUploadId, payload);

    expect(result).toEqual(response);
  });

  it('updateSubmissionUploadReview patches a scoped upload review task', async () => {
    const submissionUploadId = '22222222-2222-4222-8222-222222222222';
    const submissionUploadReviewId = '11111111-1111-4111-8111-111111111111';
    const payload = { status: 'completed' as const };
    const response: TicketSubmissionUploadReviewResponse = {
      submission_upload_review_id: submissionUploadReviewId,
      submission_upload_id: submissionUploadId,
      scope: 'security',
      status: 'completed',
      requested_by: 7
    };

    mock
      .onPatch(
        `/api/administrative/submission-upload/${submissionUploadId}/review/${submissionUploadReviewId}`,
        payload
      )
      .reply(200, response);

    const result = await useTicketsApi(axios).updateSubmissionUploadReview(
      submissionUploadId,
      submissionUploadReviewId,
      payload
    );

    expect(result).toEqual(response);
  });

  it('createTicketReference posts payload and returns reference row', async () => {
    const ticketId = '11111111-1111-1111-1111-111111111111';
    const payload: ICreateTicketReferenceRequest = {
      references: [
        {
          target_ticket_id: '22222222-2222-2222-2222-222222222222',
          relationship: 'relates_to'
        },
        {
          target_ticket_id: '33333333-3333-3333-3333-333333333333',
          relationship: 'relates_to'
        }
      ]
    };
    const referenceItems: ITicketReference[] = [
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

  it('getTicketsForUser fetches from /api/tickets with optional params', async () => {
    const response: IGetTicketsResponse = {
      tickets: [],
      pagination: { total: 0, current_page: 1, last_page: 1, per_page: 10 }
    };

    mock.onGet('/api/tickets').reply(200, response);

    const result = await useTicketsApi(axios).getTicketsForUser({ status: 'open', page: 1, limit: 10 });

    expect(result).toEqual(response);
  });

  it('getTicketForUser fetches ticket from /api/tickets/:ticketId', async () => {
    const ticketId = '11111111-1111-1111-1111-111111111111';
    const apiTicket: ITicketExtended = {
      ticket_id: ticketId,
      ticket_slug: '04900001',
      subject: 'Test ticket',
      description: null,
      team_id: '22222222-2222-2222-2222-222222222222',
      create_date: '2026-02-25T00:00:00.000Z',
      priority: 'medium',
      status: 'open',
      statuses: [],
      comments: [],
      artifacts: [],
      references: [],
      data_requests: [],
      submission_uploads: [],
      ticket_system_users: []
    };

    mock.onGet(`/api/tickets/${ticketId}`).reply(200, apiTicket);

    const result = await useTicketsApi(axios).getTicketForUser(ticketId);

    expect(result).toEqual(apiTicket);
  });

  it('createTicketSystemUsers posts payload and returns ticket system users', async () => {
    const ticketId = '11111111-1111-1111-1111-111111111111';
    const payload: ICreateTicketSystemUser[] = [{ system_user_id: 12, status: 'requested' }];
    const ticketSystemUser: ITicketSystemUser = {
      ticket_system_user_id: '22222222-2222-2222-2222-222222222222',
      ticket_id: ticketId,
      system_user_id: 12,
      status: 'requested',
      system_user: {
        system_user_id: 12,
        display_name: 'Sarah',
        user_identifier: 'sarah',
        email: 'sarah@example.com'
      }
    };

    mock.onPost(`/api/tickets/${ticketId}/system-user`, payload).reply(201, [ticketSystemUser]);

    const result = await useTicketsApi(axios).createTicketSystemUsers(ticketId, payload);

    expect(result).toEqual([ticketSystemUser]);
  });

  it('updateTicketSystemUserStatus patches payload and returns ticket system user', async () => {
    const ticketId = '11111111-1111-1111-1111-111111111111';
    const ticketSystemUserId = '33333333-3333-3333-3333-333333333333';
    const payload: IUpdateTicketSystemUserStatusRequest = { status: 'started' };
    const ticketSystemUser: ITicketSystemUser = {
      ticket_system_user_id: ticketSystemUserId,
      ticket_id: ticketId,
      system_user_id: 12,
      status: 'started',
      system_user: {
        system_user_id: 12,
        display_name: 'Sarah',
        user_identifier: 'sarah',
        email: 'sarah@example.com'
      }
    };

    mock.onPatch(`/api/tickets/${ticketId}/system-user/${ticketSystemUserId}`, payload).reply(200, ticketSystemUser);

    const result = await useTicketsApi(axios).updateTicketSystemUserStatus(ticketId, ticketSystemUserId, payload);

    expect(result).toEqual(ticketSystemUser);
  });

  it('deleteTicketSystemUser calls delete endpoint', async () => {
    const ticketId = '11111111-1111-1111-1111-111111111111';
    const ticketSystemUserId = '33333333-3333-3333-3333-333333333333';

    mock.onDelete(`/api/tickets/${ticketId}/system-user/${ticketSystemUserId}`).reply(204);

    await expect(useTicketsApi(axios).deleteTicketSystemUser(ticketId, ticketSystemUserId)).resolves.toBeUndefined();
  });
});
