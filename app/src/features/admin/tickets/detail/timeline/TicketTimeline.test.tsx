import { act, fireEvent, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useApi } from 'hooks/useApi';
import { useConfigContext, useDialogContext, useTicketContext } from 'hooks/useContext';
import { ITicketArtifact, ITicketExtended, TicketSubmissionUploadResponse } from 'interfaces/useTicketsApi.interface';
import { MemoryRouter } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { TicketTimeline } from './TicketTimeline';
import { useTicketTimelineCommentActions } from './hooks/comment/useTicketTimelineCommentActions';

vi.mock('hooks/useApi', () => ({
  useApi: vi.fn()
}));

vi.mock('hooks/useContext', () => ({
  useConfigContext: vi.fn(),
  useDialogContext: vi.fn(),
  useTicketContext: vi.fn()
}));

vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange }: { value?: string; onChange?: (value: string) => void }) => (
    <textarea data-testid="monaco-editor" value={value || ''} onChange={(event) => onChange?.(event.target.value)} />
  ),
  loader: {
    init: vi.fn().mockResolvedValue({
      languages: {
        json: {
          jsonDefaults: {
            setDiagnosticsOptions: vi.fn()
          }
        }
      }
    })
  }
}));

const ticketId = '22222222-2222-4222-8222-222222222222';
const ticketCommentId = '33333333-3333-4333-8333-333333333333';
const ticketArtifact: ITicketArtifact = {
  ticket_artifact_id: '55555555-5555-4555-8555-555555555555',
  ticket_id: ticketId,
  artifact_id: '66666666-6666-4666-8666-666666666666',
  record_end_date: null,
  create_date: '2026-02-25T00:00:00.000Z',
  object_key: 'tickets/test/notes.txt'
};

const makeSubmissionUpload = (): TicketSubmissionUploadResponse => ({
  submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
  submission_uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  upload_id: '77777777-7777-4777-8777-777777777777',
  create_date: '2026-02-26T00:00:00.000Z',
  submission_name: 'Moose survey',
  submission_description: null,
  submission_comment: null,
  submitted_by_identifier: 'sarah@example.com',
  upload_status: 'ingested',
  review_status: 'submitted',
  validation: null,
  reviews: { validation: null, security: null }
});

const makeTicket = (): ITicketExtended => ({
  ticket_id: ticketId,
  ticket_slug: 'TICKET-1',
  subject: 'Ticket subject',
  description: null,
  team_id: '44444444-4444-4444-8444-444444444444',
  create_date: '2026-02-25T00:00:00.000Z',
  priority: 'medium',
  status: 'open',
  statuses: [],
  comments: [
    {
      ticket_comment_id: ticketCommentId,
      ticket_id: ticketId,
      user_identifier: 'sarah@example.com',
      create_date: '2026-02-25T00:00:00.000Z',
      comment: 'Original comment',
      artifacts: [ticketArtifact]
    }
  ],
  references: [],
  data_requests: [],
  submission_uploads: [],
  ticket_system_users: []
});

const renderTicketTimeline = (ticket: ITicketExtended) =>
  render(
    <MemoryRouter>
      <TicketTimeline ticket={ticket} isLoading={false} />
    </MemoryRouter>
  );

describe('TicketTimeline', () => {
  const updateTicketComment = vi.fn();
  const deleteTicketComment = vi.fn();
  const getSubmissionUploadProcessingStatusHistory = vi.fn();
  const setData = vi.fn();
  const setSnackbar = vi.fn();
  const setYesNoDialog = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    (useApi as Mock).mockReturnValue({
      tickets: {
        updateTicketComment,
        deleteTicketComment,
        getSubmissionUploadProcessingStatusHistory,
        createTicketUpload: vi.fn(),
        completeTicketUpload: vi.fn(),
        getTicketArtifactDownloadUrl: vi.fn()
      },
      policies: {
        updatePolicyStatus: vi.fn(),
        getPolicy: vi.fn(),
        updatePolicy: vi.fn()
      },
      objectStorage: {
        uploadFileToUrl: vi.fn()
      }
    });
    (useConfigContext as Mock).mockReturnValue({
      MAX_TICKET_ATTACHMENT_FILE_SIZE: 15728640
    });
    (useDialogContext as Mock).mockReturnValue({
      setSnackbar,
      setYesNoDialog
    });
    (useTicketContext as Mock).mockReturnValue({
      ticketId,
      ticketDataLoader: {
        data: makeTicket(),
        setData
      }
    });
  });

  it('opens edit dialog with existing comment and saves updated text', async () => {
    const user = userEvent.setup();
    const ticket = makeTicket();
    const authoredComment = 'Updated comment\nwith a second line\n';
    const updatedComment = {
      ...ticket.comments[0],
      comment: authoredComment
    };
    updateTicketComment.mockResolvedValue(updatedComment);

    renderTicketTimeline(ticket);

    await user.click(screen.getByRole('button', { name: `ticket-comment-${ticketCommentId}-menu` }));
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));

    const commentInput = screen.getByPlaceholderText('Type your comment...');
    expect(commentInput).toHaveValue('Original comment');

    fireEvent.change(commentInput, { target: { value: authoredComment } });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(updateTicketComment).toHaveBeenCalledWith(ticketId, ticketCommentId, { comment: authoredComment });
    });
    expect(setData).toHaveBeenCalledWith({
      ...ticket,
      comments: [updatedComment]
    });
  });

  it('opens edit dialog for a comment that was just added to cached ticket data', () => {
    const cachedTicket = makeTicket();
    (useTicketContext as Mock).mockReturnValue({
      ticketId,
      ticketDataLoader: {
        data: cachedTicket,
        setData
      }
    });

    const { result } = renderHook(() => useTicketTimelineCommentActions());

    act(() => {
      result.current.handleOpenEditCommentDialog(ticketCommentId);
    });

    expect(result.current.selectedComment).toEqual(cachedTicket.comments[0]);
    expect(result.current.isEditCommentDialogOpen).toBe(true);
  });

  it('renders timeline comment markdown using artifacts attached to that comment', () => {
    const ticket = makeTicket();
    ticket.comments[0] = {
      ...ticket.comments[0],
      comment: `[notes](/artifact/${ticketArtifact.ticket_artifact_id})`
    };

    renderTicketTimeline(ticket);

    expect(screen.getByRole('button', { name: 'notes' })).toBeVisible();
  });

  it('ignores duplicate edit saves while save is in flight', async () => {
    const user = userEvent.setup();
    let resolveUpdate: (updatedComment: ITicketExtended['comments'][number]) => void = vi.fn();
    const ticket = makeTicket();
    const updatedComment = {
      ...ticket.comments[0],
      comment: 'Updated comment'
    };
    updateTicketComment.mockReturnValue(
      new Promise((resolve) => {
        resolveUpdate = resolve;
      })
    );

    renderTicketTimeline(ticket);

    await user.click(screen.getByRole('button', { name: `ticket-comment-${ticketCommentId}-menu` }));
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));

    const commentInput = screen.getByPlaceholderText('Type your comment...');
    fireEvent.change(commentInput, { target: { value: 'Updated comment' } });

    const saveButton = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(saveButton);
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(updateTicketComment).toHaveBeenCalledTimes(1);
    });

    resolveUpdate(updatedComment);
    await waitFor(() => {
      expect(setData).toHaveBeenCalledWith({
        ...ticket,
        comments: [updatedComment]
      });
    });
  });

  it('deletes a comment and removes it from cached ticket data', async () => {
    const user = userEvent.setup();
    const ticket = makeTicket();
    deleteTicketComment.mockResolvedValue(undefined);

    renderTicketTimeline(ticket);

    await user.click(screen.getByRole('button', { name: `ticket-comment-${ticketCommentId}-menu` }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));

    expect(deleteTicketComment).not.toHaveBeenCalled();
    expect(setYesNoDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        open: true,
        dialogTitle: 'Delete Comment',
        dialogText: 'Are you sure you want to delete this comment?',
        yesButtonLabel: 'Delete',
        noButtonLabel: 'Cancel'
      })
    );

    const confirmationConfig = setYesNoDialog.mock.calls[0][0];
    await confirmationConfig.onYes();

    await waitFor(() => {
      expect(deleteTicketComment).toHaveBeenCalledWith(ticketId, ticketCommentId);
    });
    expect(setData).toHaveBeenCalledWith({
      ...ticket,
      comments: []
    });
  });

  it('ignores duplicate delete confirmations while delete is in flight', async () => {
    const user = userEvent.setup();
    let resolveDelete: () => void = vi.fn();
    deleteTicketComment.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveDelete = resolve;
      })
    );

    renderTicketTimeline(makeTicket());

    await user.click(screen.getByRole('button', { name: `ticket-comment-${ticketCommentId}-menu` }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));

    const confirmationConfig = setYesNoDialog.mock.calls[0][0];
    const firstDelete = confirmationConfig.onYes();
    await confirmationConfig.onYes();

    expect(deleteTicketComment).toHaveBeenCalledTimes(1);

    resolveDelete();
    await firstDelete;
  });

  it('shows snackbar and preserves cache when delete fails', async () => {
    const user = userEvent.setup();
    const ticket = makeTicket();
    deleteTicketComment.mockRejectedValue(new Error('Delete failed'));

    renderTicketTimeline(ticket);

    await user.click(screen.getByRole('button', { name: `ticket-comment-${ticketCommentId}-menu` }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));

    const confirmationConfig = setYesNoDialog.mock.calls[0][0];
    await confirmationConfig.onYes();

    await waitFor(() => {
      expect(setSnackbar).toHaveBeenCalledWith({
        open: true,
        snackbarMessage: 'Delete failed'
      });
    });
    expect(setData).not.toHaveBeenCalled();
  });

  it('requests an upload processing history only when its status row is expanded', async () => {
    const user = userEvent.setup();
    const upload = makeSubmissionUpload();
    getSubmissionUploadProcessingStatusHistory.mockResolvedValue([
      {
        submission_upload_status_id: 1,
        submission_upload_id: upload.submission_upload_id,
        status: 'uploaded',
        create_date: '2026-02-26T00:00:00.000Z'
      }
    ]);

    renderTicketTimeline({ ...makeTicket(), submission_uploads: [upload] });

    expect(getSubmissionUploadProcessingStatusHistory).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Ingested' }));

    await waitFor(() => expect(screen.getByText('Uploaded')).toBeVisible());
    expect(getSubmissionUploadProcessingStatusHistory).toHaveBeenCalledWith(
      upload.submission_uuid,
      upload.submission_upload_id
    );
    expect(getSubmissionUploadProcessingStatusHistory).toHaveBeenCalledTimes(1);
  });
});
