import { ITicketArtifact } from 'interfaces/useTicketsApi.interface';
import { createTestQueryClient } from 'test-helpers/query-client';
import { act, renderHook, waitFor } from 'test-helpers/test-utils';
import { ticketQueryKeys } from 'utils/query-keys/ticket-query-keys';
import { useTicketAttachmentUpload } from './useTicketAttachmentUpload';

const mocks = vi.hoisted(() => ({
  ticketId: 'ticket-a',
  initialize: vi.fn(),
  upload: vi.fn(),
  complete: vi.fn(),
  snackbar: vi.fn()
}));
vi.mock('hooks/useApi', () => ({
  useApi: () => ({
    tickets: { createTicketUpload: mocks.initialize, completeTicketUpload: mocks.complete },
    objectStorage: { uploadFileToUrl: mocks.upload }
  })
}));
vi.mock('hooks/useContext', () => ({
  useTicketContext: () => ({ ticketId: mocks.ticketId }),
  useDialogContext: () => ({ setSnackbar: mocks.snackbar }),
  useConfigContext: () => ({ MAX_TICKET_ATTACHMENT_FILE_SIZE: 10000 })
}));

describe('useTicketAttachmentUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ticketId = 'ticket-a';
  });

  it('keeps queued files and cache refreshes on the original ticket after navigation', async () => {
    const queryClient = createTestQueryClient();
    const originalKey = ticketQueryKeys.artifacts('ticket-a', { page: 1 });
    const otherKey = ticketQueryKeys.artifacts('ticket-b', { page: 1 });
    const cached = { artifacts: [] };
    queryClient.setQueryData(originalKey, cached);
    queryClient.setQueryData(otherKey, cached);
    let finishUploads!: () => void;
    mocks.initialize.mockResolvedValue({ presigned_upload_url: 'url', upload_id: 'upload' });
    mocks.upload.mockReturnValue(
      new Promise<void>((resolve) => {
        finishUploads = resolve;
      })
    );
    mocks.complete.mockResolvedValue({ ticket_artifact_id: 'artifact', ticket_id: 'ticket-a' });
    const { result, rerender } = renderHook(() => useTicketAttachmentUpload(), { queryClient });
    let batch!: Promise<ITicketArtifact[]>;
    act(() => {
      batch = result.current.uploadTicketAttachments([1, 2, 3, 4].map((index) => new File(['x'], `${index}.txt`)));
    });
    await waitFor(() => expect(mocks.initialize).toHaveBeenCalledTimes(3));

    mocks.ticketId = 'ticket-b';
    rerender();
    await act(async () => {
      finishUploads();
      await batch;
    });

    expect(mocks.initialize.mock.calls.map(([ticketId]) => ticketId)).toEqual([
      'ticket-a',
      'ticket-a',
      'ticket-a',
      'ticket-a'
    ]);
    expect(mocks.complete.mock.calls.map(([ticketId]) => ticketId)).toEqual([
      'ticket-a',
      'ticket-a',
      'ticket-a',
      'ticket-a'
    ]);
    expect(queryClient.getQueryData(originalKey)).toBeUndefined();
    expect(queryClient.getQueryData(otherKey)).toEqual(cached);
  });
});
