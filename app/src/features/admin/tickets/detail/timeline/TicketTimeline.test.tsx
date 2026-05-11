import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useApi } from 'hooks/useApi';
import { useConfigContext, useDialogContext, useTicketContext } from 'hooks/useContext';
import { ITicketExtended } from 'interfaces/useTicketsApi.interface';
import { render } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { TicketTimeline } from './TicketTimeline';

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
      comment: 'Original comment'
    }
  ],
  artifacts: [],
  references: [],
  data_requests: [],
  submission_uploads: [],
  ticket_system_users: []
});

describe('TicketTimeline', () => {
  const updateTicketComment = vi.fn();
  const deleteTicketComment = vi.fn();
  const setData = vi.fn();
  const setSnackbar = vi.fn();
  const setYesNoDialog = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    (useApi as Mock).mockReturnValue({
      tickets: {
        updateTicketComment,
        deleteTicketComment,
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
      ticketDataLoader: {
        data: makeTicket(),
        setData
      }
    });
  });

  it('opens edit dialog with existing comment and saves updated text', async () => {
    const user = userEvent.setup();
    const ticket = makeTicket();
    const updatedComment = {
      ...ticket.comments[0],
      comment: 'Updated comment'
    };
    updateTicketComment.mockResolvedValue(updatedComment);

    render(<TicketTimeline ticket={ticket} isLoading={false} />);

    await user.click(screen.getByRole('button', { name: `ticket-comment-${ticketCommentId}-menu` }));
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));

    const commentInput = screen.getByPlaceholderText('Type your comment...');
    expect(commentInput).toHaveValue('Original comment');

    fireEvent.change(commentInput, { target: { value: 'Updated comment' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(updateTicketComment).toHaveBeenCalledWith(ticketId, ticketCommentId, { comment: 'Updated comment' });
    });
    expect(setData).toHaveBeenCalledWith({
      ...ticket,
      comments: [updatedComment]
    });
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

    render(<TicketTimeline ticket={ticket} isLoading={false} />);

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

    render(<TicketTimeline ticket={ticket} isLoading={false} />);

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

    render(<TicketTimeline ticket={makeTicket()} isLoading={false} />);

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

    render(<TicketTimeline ticket={ticket} isLoading={false} />);

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
});
