import { act, renderHook } from '@testing-library/react';
import { useApi } from 'hooks/useApi';
import {
  ISubmissionUploadProcessingStatusHistoryItem,
  TicketSubmissionUploadResponse
} from 'interfaces/useTicketsApi.interface';
import { Mock } from 'vitest';
import { useSubmissionUploadStatusHistory } from './useSubmissionUploadStatusHistory';

vi.mock('hooks/useApi', () => ({
  useApi: vi.fn()
}));

const makeUpload = (submissionUploadId: string): TicketSubmissionUploadResponse => ({
  submission_upload_id: submissionUploadId,
  submission_uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  upload_id: '44444444-4444-4444-8444-444444444444',
  create_date: '2026-09-03T00:00:00.000Z',
  submission_name: 'Submission',
  submission_description: null,
  submission_comment: null,
  submitted_by_identifier: null,
  upload_status: 'ingested',
  review_status: 'submitted',
  validation: null,
  reviews: { validation: null, security: null }
});

const history: ISubmissionUploadProcessingStatusHistoryItem[] = [
  {
    submission_upload_status_id: 1,
    submission_upload_id: 'upload-1',
    status: 'uploaded',
    create_date: '2026-09-03T00:00:00.000Z'
  }
];

describe('useSubmissionUploadStatusHistory', () => {
  const getSubmissionUploadProcessingStatusHistory = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useApi as Mock).mockReturnValue({ tickets: { getSubmissionUploadProcessingStatusHistory } });
  });

  it('starts with no history and requests nothing until asked', () => {
    const { result } = renderHook(() => useSubmissionUploadStatusHistory());

    expect(result.current.statusHistoryByUploadId).toEqual({});
    expect(getSubmissionUploadProcessingStatusHistory).not.toHaveBeenCalled();
  });

  it('loads history once per upload and reuses the cached response', async () => {
    getSubmissionUploadProcessingStatusHistory.mockResolvedValue(history);
    const { result } = renderHook(() => useSubmissionUploadStatusHistory());

    await act(async () => {
      await result.current.loadStatusHistory(makeUpload('upload-1'));
    });
    await act(async () => {
      await result.current.loadStatusHistory(makeUpload('upload-1'));
    });

    expect(getSubmissionUploadProcessingStatusHistory).toHaveBeenCalledTimes(1);
    expect(getSubmissionUploadProcessingStatusHistory).toHaveBeenCalledWith(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'upload-1'
    );
    expect(result.current.statusHistoryByUploadId['upload-1']).toEqual({ status: 'loaded', history });
  });

  it('caches per upload', async () => {
    getSubmissionUploadProcessingStatusHistory.mockResolvedValue(history);
    const { result } = renderHook(() => useSubmissionUploadStatusHistory());

    await act(async () => {
      await result.current.loadStatusHistory(makeUpload('upload-1'));
      await result.current.loadStatusHistory(makeUpload('upload-2'));
    });

    expect(getSubmissionUploadProcessingStatusHistory).toHaveBeenCalledTimes(2);
    expect(Object.keys(result.current.statusHistoryByUploadId)).toEqual(['upload-1', 'upload-2']);
  });

  it('records the error and retries on the next request', async () => {
    getSubmissionUploadProcessingStatusHistory.mockRejectedValueOnce(new Error('Forbidden'));
    getSubmissionUploadProcessingStatusHistory.mockResolvedValueOnce(history);
    const { result } = renderHook(() => useSubmissionUploadStatusHistory());

    await act(async () => {
      await result.current.loadStatusHistory(makeUpload('upload-1'));
    });
    expect(result.current.statusHistoryByUploadId['upload-1']).toEqual({ status: 'error', message: 'Forbidden' });

    await act(async () => {
      await result.current.loadStatusHistory(makeUpload('upload-1'));
    });

    expect(getSubmissionUploadProcessingStatusHistory).toHaveBeenCalledTimes(2);
    expect(result.current.statusHistoryByUploadId['upload-1']).toEqual({ status: 'loaded', history });
  });

  it('does not issue a second request while the first is in flight', async () => {
    let resolveHistory: (value: ISubmissionUploadProcessingStatusHistoryItem[]) => void = () => undefined;
    getSubmissionUploadProcessingStatusHistory.mockReturnValue(
      new Promise<ISubmissionUploadProcessingStatusHistoryItem[]>((resolve) => {
        resolveHistory = resolve;
      })
    );
    const { result } = renderHook(() => useSubmissionUploadStatusHistory());

    let firstLoad: Promise<void> = Promise.resolve();
    act(() => {
      firstLoad = result.current.loadStatusHistory(makeUpload('upload-1'));
    });
    expect(result.current.statusHistoryByUploadId['upload-1']).toEqual({ status: 'loading' });

    await act(async () => {
      await result.current.loadStatusHistory(makeUpload('upload-1'));
    });
    expect(getSubmissionUploadProcessingStatusHistory).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveHistory(history);
      await firstLoad;
    });
    expect(result.current.statusHistoryByUploadId['upload-1']).toEqual({ status: 'loaded', history });
  });
});
