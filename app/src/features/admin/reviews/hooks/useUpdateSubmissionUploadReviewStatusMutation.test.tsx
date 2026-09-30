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
    queryClient.setQueryData(submissionUploadQueryKeys.reviewDetail(scope), review('in_progress'));
    const updated = review('completed');
    mocks.update.mockResolvedValue(updated);
    const { result } = renderHook(() => useUpdateSubmissionUploadReviewStatusMutation(scope), { queryClient });

    act(() => result.current.mutate('completed'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.update).toHaveBeenCalledWith(16, 'upload-id', 'review-id', 'completed');
    expect(queryClient.getQueryData(submissionUploadQueryKeys.reviewDetail(scope))).toEqual(updated);
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

  it('leaves the cached review unchanged when the update fails', async () => {
    const queryClient = createTestQueryClient();
    const cached = review('in_progress');
    queryClient.setQueryData(submissionUploadQueryKeys.reviewDetail(scope), cached);
    mocks.update.mockRejectedValue(new Error('Update failed'));
    const { result } = renderHook(() => useUpdateSubmissionUploadReviewStatusMutation(scope), { queryClient });

    act(() => result.current.mutate('completed'));

    await waitFor(() => expect(result.current.error?.message).toBe('Update failed'));
    expect(queryClient.getQueryData(submissionUploadQueryKeys.reviewDetail(scope))).toBe(cached);
  });
});
