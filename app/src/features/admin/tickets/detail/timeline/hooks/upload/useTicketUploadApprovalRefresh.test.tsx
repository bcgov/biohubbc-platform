import { useTicketContext } from 'hooks/useContext';
import { ITicketExtended, TicketSubmissionUploadResponse } from 'interfaces/useTicketsApi.interface';
import { createTestQueryClient } from 'test-helpers/query-client';
import { act, renderHook } from 'test-helpers/test-utils';
import { refreshChangedQueries } from 'utils/query-client';
import { Mock } from 'vitest';
import { TICKET_UPLOAD_APPROVAL_REFRESH_MS, useTicketUploadApprovalRefresh } from './useTicketUploadApprovalRefresh';

vi.mock('hooks/useContext', () => ({
  useTicketContext: vi.fn()
}));

vi.mock('utils/query-client', () => ({
  refreshChangedQueries: vi.fn()
}));

const ticketQueryKey = ['ticket', 'admin', 'detail', 'ticket-id'];

const upload: TicketSubmissionUploadResponse = {
  submission_upload_id: '22222222-2222-4222-8222-222222222222',
  submission_id: 17,
  upload_id: '44444444-4444-4444-8444-444444444444',
  create_date: '2026-09-04T12:00:00.000Z',
  submission_name: 'Test submission',
  submission_description: null,
  submission_comment: null,
  submitted_by_identifier: 'admin@example.com',
  upload_status: 'indexed',
  decision: 'pending',
  validation: null,
  reviews: {
    security: [],
    validation: []
  }
};

/**
 * Build a ticket whose only upload has the given decision.
 *
 * @param {TicketSubmissionUploadResponse['decision']} decision Decision of the ticket's upload.
 * @returns {ITicketExtended} Ticket carrying the fields the hook reads.
 */
const ticketWithDecision = (decision: TicketSubmissionUploadResponse['decision']): ITicketExtended =>
  ({ submission_uploads: [{ ...upload, decision }] }) as unknown as ITicketExtended;

describe('useTicketUploadApprovalRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    (useTicketContext as Mock).mockReturnValue({ ticketId: 'ticket-id', ticketQueryKey });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reloads the ticket on an interval while an upload is approving', () => {
    const queryClient = createTestQueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    renderHook(() => useTicketUploadApprovalRefresh(ticketWithDecision('approving')), { queryClient });
    act(() => {
      vi.advanceTimersByTime(TICKET_UPLOAD_APPROVAL_REFRESH_MS * 2);
    });

    expect(invalidateQueries).toHaveBeenCalledTimes(2);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ticketQueryKey, exact: true });
  });

  it('does not reload a ticket with no approving upload', () => {
    const queryClient = createTestQueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    renderHook(() => useTicketUploadApprovalRefresh(ticketWithDecision('pending')), { queryClient });
    act(() => {
      vi.advanceTimersByTime(TICKET_UPLOAD_APPROVAL_REFRESH_MS * 3);
    });

    expect(invalidateQueries).not.toHaveBeenCalled();
    expect(refreshChangedQueries).not.toHaveBeenCalled();
  });

  it('stops reloading and refreshes decision-dependent queries once the approval is applied', () => {
    const queryClient = createTestQueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const { rerender } = renderHook((ticket: ITicketExtended) => useTicketUploadApprovalRefresh(ticket), {
      queryClient,
      initialProps: ticketWithDecision('approving')
    });

    rerender(ticketWithDecision('approved'));
    act(() => {
      vi.advanceTimersByTime(TICKET_UPLOAD_APPROVAL_REFRESH_MS * 2);
    });

    expect(invalidateQueries).not.toHaveBeenCalled();
    expect(refreshChangedQueries).toHaveBeenCalledTimes(1);
    expect((refreshChangedQueries as Mock).mock.lastCall?.[2]).toEqual(ticketQueryKey);
  });
});
