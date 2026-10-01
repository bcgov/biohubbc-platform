import { useQuery } from '@tanstack/react-query';
import { submissionUploadQueryKeys } from 'features/admin/reviews/submission-upload-query-keys';
import { createTestQueryClient } from 'test-helpers/query-client';
import { act, renderHook, waitFor } from 'test-helpers/test-utils';
import { useUpdateSubmissionUploadReviewStatusMutation } from './useUpdateSubmissionUploadReviewStatusMutation';

const mocks = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock('hooks/useApi', () => ({
  useApi: () => ({ admin: { updateSubmissionUploadReview: mocks.update } })
}));

const scope = { submissionId: 16, submissionUploadId: 'upload-id', submissionUploadReviewId: 'review-id' };
const review = (status: 'in_progress' | 'completed') => ({
  submission_upload_review_id: 'review-id',
  submission_upload_id: 'upload-id',
  name: 'Security pass',
  description: null,
  scope: 'security',
  status,
  requested_by: 1
});

describe('useUpdateSubmissionUploadReviewStatusMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes the updated review into the review detail query', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(
      submissionUploadQueryKeys.reviewDetail(scope.submissionUploadReviewId),
      review('in_progress')
    );
    const updated = review('completed');
    mocks.update.mockResolvedValue(updated);
    const { result } = renderHook(() => useUpdateSubmissionUploadReviewStatusMutation(scope), { queryClient });

    act(() => result.current.mutate('completed'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.update).toHaveBeenCalledWith(16, 'upload-id', 'review-id', 'completed');
    expect(queryClient.getQueryData(submissionUploadQueryKeys.reviewDetail(scope.submissionUploadReviewId))).toEqual(
      updated
    );
  });

  it('drops the cached ticket timelines and dashboard lists that show the review status', async () => {
    const queryClient = createTestQueryClient();
    const shown = [
      ['ticket', 'admin', 'detail', 'ticket-1'],
      ['ticket', 'user', 'detail', 'ticket-1'],
      ['submission', 'admin-list', 'unreviewed']
    ];
    shown.forEach((key) => queryClient.setQueryData(key, { cached: true }));
    mocks.update.mockResolvedValue(review('completed'));
    const { result } = renderHook(() => useUpdateSubmissionUploadReviewStatusMutation(scope), { queryClient });

    act(() => result.current.mutate('completed'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(shown.map((key) => queryClient.getQueryData(key))).toEqual([undefined, undefined, undefined]);
  });

  it('writes to the original review after navigating to another cached review', async () => {
    const queryClient = createTestQueryClient();
    const otherScope = { ...scope, submissionUploadReviewId: 'other-review' };
    const originalKey = submissionUploadQueryKeys.reviewDetail(scope.submissionUploadReviewId);
    const otherKey = submissionUploadQueryKeys.reviewDetail(otherScope.submissionUploadReviewId);
    const otherReview = { ...review('in_progress'), submission_upload_review_id: 'other-review' };
    queryClient.setQueryData(originalKey, review('in_progress'));
    queryClient.setQueryData(otherKey, otherReview);
    let finish!: (value: ReturnType<typeof review>) => void;
    mocks.update.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    const { result, rerender } = renderHook(
      (currentScope) => useUpdateSubmissionUploadReviewStatusMutation(currentScope),
      {
        queryClient,
        initialProps: scope
      }
    );

    act(() => result.current.mutate('completed'));
    await waitFor(() => expect(mocks.update).toHaveBeenCalled());
    rerender(otherScope);
    await act(async () => finish(review('completed')));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(originalKey)).toEqual(review('completed'));
    expect(queryClient.getQueryData(otherKey)).toEqual(otherReview);
  });

  it('keeps the saved status when an older background read finishes', async () => {
    const queryClient = createTestQueryClient();
    const queryKey = submissionUploadQueryKeys.reviewDetail(scope.submissionUploadReviewId);
    const original = review('in_progress');
    const saved = review('completed');
    queryClient.setQueryData(queryKey, original, { updatedAt: Date.now() - 6000 });
    let finishRead!: (value: ReturnType<typeof review>) => void;
    const read = vi
      .fn()
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finishRead = resolve;
        })
      )
      .mockResolvedValue(saved);
    mocks.update.mockResolvedValue(saved);
    const { result } = renderHook(
      () => {
        useQuery({ queryKey, queryFn: ({ signal }) => read(signal) });
        return useUpdateSubmissionUploadReviewStatusMutation(scope);
      },
      { queryClient }
    );
    await waitFor(() => expect(read).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.mutateAsync('completed');
    });
    await act(async () => finishRead(original));

    await waitFor(() => expect(queryClient.isFetching({ queryKey })).toBe(0));
    expect(queryClient.getQueryData(queryKey)).toEqual(saved);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('leaves the cached review unchanged when the update fails', async () => {
    const queryClient = createTestQueryClient();
    const cached = review('in_progress');
    queryClient.setQueryData(submissionUploadQueryKeys.reviewDetail(scope.submissionUploadReviewId), cached);
    mocks.update.mockRejectedValue(new Error('Update failed'));
    const { result } = renderHook(() => useUpdateSubmissionUploadReviewStatusMutation(scope), { queryClient });

    act(() => result.current.mutate('completed'));

    await waitFor(() => expect(result.current.error?.message).toBe('Update failed'));
    expect(queryClient.getQueryData(submissionUploadQueryKeys.reviewDetail(scope.submissionUploadReviewId))).toBe(
      cached
    );
  });
});
