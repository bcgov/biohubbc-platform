import { act, renderHook } from '@testing-library/react';
import { ITicketArtifact, ITicketExtended } from 'interfaces/useTicketsApi.interface';
import { Mock } from 'vitest';
import { useAuthStateContext } from 'hooks/useAuthStateContext';
import { useApi } from 'hooks/useApi';
import { useConfigContext, useDialogContext, useTicketContext } from 'hooks/useContext';
import { useTicketComment } from './useTicketComment';

vi.mock('hooks/useApi', () => ({
  useApi: vi.fn()
}));

vi.mock('hooks/useAuthStateContext', () => ({
  useAuthStateContext: vi.fn()
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
  artifacts: [],
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

const setupUploadHook = (ticketArtifact: ITicketArtifact) => {
  const setSnackbar = vi.fn();
  const setData = vi.fn();
  const createTicketUpload = vi.fn().mockResolvedValue({
    upload_id: '44444444-4444-4444-8444-444444444444',
    presigned_upload_url: 'https://object-store.example/upload'
  });
  const completeTicketUpload = vi.fn().mockResolvedValue(ticketArtifact);
  const uploadFileToUrl = vi.fn().mockResolvedValue(undefined);

  (useApi as Mock).mockReturnValue({
    tickets: {
      createTicketComment: vi.fn(),
      createTicketUpload,
      completeTicketUpload
    },
    objectStorage: {
      uploadFileToUrl
    }
  });
  (useAuthStateContext as Mock).mockReturnValue({
    biohubUserWrapper: {
      userIdentifier: 'user@example.com'
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
      setData
    }
  });

  return {
    completeTicketUpload,
    createTicketUpload,
    setData,
    setSnackbar,
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
