import { act, renderHook } from '@testing-library/react';
import { useApi } from 'hooks/useApi';
import { useConfigContext, useDialogContext, useTicketContext } from 'hooks/useContext';
import { ITicketArtifact, ITicketCommentLog, ITicketExtended } from 'interfaces/useTicketsApi.interface';
import { Mock } from 'vitest';
import { useTicketComment } from './useTicketComment';

vi.mock('hooks/useApi', () => ({
  useApi: vi.fn()
}));

vi.mock('hooks/useContext', () => ({
  useConfigContext: vi.fn(),
  useDialogContext: vi.fn(),
  useTicketContext: vi.fn()
}));

const ticketId = '22222222-2222-4222-8222-222222222222';
const ticketArtifactId = '90b6df74-1b23-4064-ad62-f83c291d31d2';
const maxTicketAttachmentFileSize = 15728640;

const makeTicket = (): ITicketExtended => ({
  ticket_id: ticketId,
  ticket_slug: 'TICKET-1',
  subject: 'Ticket subject',
  description: null,
  team_id: '33333333-3333-4333-8333-333333333333',
  create_date: '2026-02-25T00:00:00.000Z',
  priority: 'medium',
  status: 'open',
  statuses: [],
  comments: [],
  references: [],
  data_requests: [],
  submission_uploads: [],
  ticket_system_users: []
});

const makeTicketArtifact = (fileName: string): ITicketArtifact => ({
  ticket_artifact_id: ticketArtifactId,
  ticket_id: ticketId,
  artifact_id: '11111111-1111-4111-8111-111111111111',
  record_end_date: null,
  create_date: '2026-02-25T00:00:00.000Z',
  object_key: `tickets/ticket-id/upload/upload-id/${fileName}`
});

const makeTicketComment = (comment: string, artifacts: ITicketArtifact[] = []): ITicketCommentLog => ({
  ticket_comment_id: '33333333-3333-4333-8333-333333333333',
  ticket_id: ticketId,
  user_identifier: 'user@example.com',
  create_date: '2026-02-25T00:00:00.000Z',
  comment,
  artifacts
});

const setupUploadHook = (
  ticketArtifact: ITicketArtifact,
  createTicketComment = vi.fn().mockResolvedValue(makeTicketComment('New comment'))
) => {
  const setSnackbar = vi.fn();
  const setTicketData = vi.fn();
  const createTicketUpload = vi.fn().mockResolvedValue({
    upload_id: '44444444-4444-4444-8444-444444444444',
    presigned_upload_url: 'https://object-store.example/upload'
  });
  const completeTicketUpload = vi.fn().mockResolvedValue(ticketArtifact);
  const uploadFileToUrl = vi.fn().mockResolvedValue(undefined);

  (useApi as Mock).mockReturnValue({
    tickets: {
      createTicketComment,
      createTicketUpload,
      completeTicketUpload
    },
    objectStorage: {
      uploadFileToUrl
    }
  });
  (useDialogContext as Mock).mockReturnValue({
    setSnackbar
  });
  (useConfigContext as Mock).mockReturnValue({
    MAX_TICKET_ATTACHMENT_FILE_SIZE: maxTicketAttachmentFileSize
  });
  (useTicketContext as Mock).mockReturnValue({
    ticketId,
    ticketDataLoader: {
      data: makeTicket(),
      error: undefined,
      isLoading: false,
      isReady: true,
      load: vi.fn(),
      refresh: vi.fn(),
      clear: vi.fn(),
      setData: setTicketData
    }
  });

  return {
    completeTicketUpload,
    createTicketComment,
    createTicketUpload,
    setSnackbar,
    setTicketData,
    uploadFileToUrl
  };
};

describe('useTicketComment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('appends image markdown for files with image MIME types', async () => {
    const { uploadFileToUrl } = setupUploadHook(makeTicketArtifact('diagram.png'));
    const { result } = renderHook(() => useTicketComment());
    const file = new File(['image'], 'diagram.png', { type: 'image/png' });

    await act(async () => {
      await result.current.handleUploadAttachment(file);
    });

    expect(result.current.comment).toBe(`![diagram.png](/artifact/${ticketArtifactId})`);
    expect(uploadFileToUrl).toHaveBeenCalledWith({
      url: 'https://object-store.example/upload',
      file,
      contentType: 'image/png'
    });
  });

  it('falls back to image markdown for known image extensions without MIME types', async () => {
    const { createTicketUpload, uploadFileToUrl } = setupUploadHook(makeTicketArtifact('field-photo.jpg'));
    const { result } = renderHook(() => useTicketComment());
    const file = new File(['image'], 'field-photo.jpg', { type: '' });

    await act(async () => {
      await result.current.handleUploadAttachment(file);
    });

    expect(result.current.comment).toBe(`![field-photo.jpg](/artifact/${ticketArtifactId})`);
    expect(createTicketUpload).toHaveBeenCalledWith(ticketId, {
      file_name: 'field-photo.jpg',
      byte_size: 5,
      content_type: 'application/octet-stream'
    });
    expect(uploadFileToUrl).toHaveBeenCalledWith({
      url: 'https://object-store.example/upload',
      file,
      contentType: 'application/octet-stream'
    });
  });

  it('appends link markdown for non-image files', async () => {
    setupUploadHook(makeTicketArtifact('notes.pdf'));
    const { result } = renderHook(() => useTicketComment());
    const file = new File(['pdf'], 'notes.pdf', { type: 'application/pdf' });

    await act(async () => {
      await result.current.handleUploadAttachment(file);
    });

    expect(result.current.comment).toBe(`[notes.pdf](/artifact/${ticketArtifactId})`);
  });

  it('adds a space before attachment markdown when appending to existing comment text', async () => {
    setupUploadHook(makeTicketArtifact('notes.pdf'));
    const { result } = renderHook(() => useTicketComment());
    const file = new File(['pdf'], 'notes.pdf', { type: 'application/pdf' });

    act(() => {
      result.current.setComment('See attached');
    });

    await act(async () => {
      await result.current.handleUploadAttachment(file);
    });

    expect(result.current.comment).toBe(`See attached [notes.pdf](/artifact/${ticketArtifactId})`);
  });

  it('appends a comment only after the create request resolves', async () => {
    let resolveCreateComment: (comment: ITicketCommentLog) => void = () => undefined;
    const createdComment = makeTicketComment('Review the attachment', [makeTicketArtifact('notes.pdf')]);
    const createTicketComment = vi.fn().mockReturnValue(
      new Promise<ITicketCommentLog>((resolve) => {
        resolveCreateComment = resolve;
      })
    );
    const { setTicketData } = setupUploadHook(makeTicketArtifact('notes.pdf'), createTicketComment);
    const { result } = renderHook(() => useTicketComment());

    act(() => {
      result.current.setComment('Review the attachment');
    });

    let submitPromise: Promise<void> = Promise.resolve();

    await act(async () => {
      submitPromise = result.current.handleAddComment();
      await Promise.resolve();
    });

    expect(createTicketComment).toHaveBeenCalledWith(ticketId, {
      comment: 'Review the attachment'
    });
    expect(setTicketData).not.toHaveBeenCalled();

    await act(async () => {
      resolveCreateComment(createdComment);
      await submitPromise;
    });

    expect(setTicketData).toHaveBeenCalledWith({
      ...makeTicket(),
      comments: [createdComment]
    });
  });

  it('preserves authored line breaks when creating a comment', async () => {
    const authoredComment = 'First line\nSecond line\n';
    const createTicketComment = vi.fn().mockResolvedValue(makeTicketComment(authoredComment));
    setupUploadHook(makeTicketArtifact('notes.pdf'), createTicketComment);
    const { result } = renderHook(() => useTicketComment());

    act(() => {
      result.current.setComment(authoredComment);
    });

    await act(async () => {
      await result.current.handleAddComment();
    });

    expect(createTicketComment).toHaveBeenCalledWith(ticketId, {
      comment: authoredComment
    });
  });

  it('clears the draft after a comment is created', async () => {
    const createdComment = makeTicketComment(`See attached [notes.pdf](/artifact/${ticketArtifactId})`, [
      makeTicketArtifact('notes.pdf')
    ]);
    const { setTicketData } = setupUploadHook(
      makeTicketArtifact('notes.pdf'),
      vi.fn().mockResolvedValue(createdComment)
    );
    const { result } = renderHook(() => useTicketComment());
    const file = new File(['pdf'], 'notes.pdf', { type: 'application/pdf' });

    await act(async () => {
      await result.current.handleUploadAttachment(file);
    });

    await act(async () => {
      await result.current.handleAddComment();
    });

    expect(setTicketData).toHaveBeenCalledWith({
      ...makeTicket(),
      comments: [createdComment]
    });
    expect(result.current.comment).toBe('');
  });

  it('keeps the draft when comment creation fails', async () => {
    const createError = new Error('Failed to add comment.');
    const { setSnackbar, setTicketData } = setupUploadHook(
      makeTicketArtifact('notes.pdf'),
      vi.fn().mockRejectedValue(createError)
    );
    const { result } = renderHook(() => useTicketComment());
    const file = new File(['pdf'], 'notes.pdf', { type: 'application/pdf' });

    await act(async () => {
      await result.current.handleUploadAttachment(file);
    });

    await act(async () => {
      await result.current.handleAddComment();
    });

    expect(setTicketData).not.toHaveBeenCalled();
    expect(setSnackbar).toHaveBeenCalledWith({
      open: true,
      snackbarMessage: 'Failed to add comment.'
    });
    expect(result.current.comment).toBe(`[notes.pdf](/artifact/${ticketArtifactId})`);
  });

  it('rejects attachments larger than the API limit before starting upload', async () => {
    const { completeTicketUpload, createTicketUpload, setSnackbar, uploadFileToUrl } = setupUploadHook(
      makeTicketArtifact('notes.pdf')
    );
    const { result } = renderHook(() => useTicketComment());
    const file = new File(['pdf'], 'notes.pdf', { type: 'application/pdf' });

    Object.defineProperty(file, 'size', { value: maxTicketAttachmentFileSize + 1 });

    await act(async () => {
      await result.current.handleUploadAttachment(file);
    });

    expect(setSnackbar).toHaveBeenCalledWith({
      open: true,
      snackbarMessage: 'Attachment exceeds the 15 MB limit.'
    });
    expect(createTicketUpload).not.toHaveBeenCalled();
    expect(uploadFileToUrl).not.toHaveBeenCalled();
    expect(completeTicketUpload).not.toHaveBeenCalled();
    expect(result.current.isUploadingAttachment).toBe(false);
  });
});
