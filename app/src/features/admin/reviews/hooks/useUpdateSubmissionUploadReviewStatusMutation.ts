import { useMutation, useQueryClient } from '@tanstack/react-query';
import { refreshChangedQueries } from 'utils/query-client';
import { changedQueryKeys } from 'utils/query-keys/changed-query-keys';
import { useApi } from 'hooks/useApi';
import { ISubmissionUploadReviewDetail } from 'interfaces/useAdminApi.interface';
import {
  submissionUploadQueryKeys,
  SubmissionUploadReviewKeyScope
} from 'features/admin/reviews/submission-upload-query-keys';

/**
 * Completes or reopens a review, writing the updated review into the review detail query and refreshing the ticket
 * timelines and dashboard lists that show review status. The returned review ID identifies the cache entry across navigation,
 * and reads started before the save are cancelled and reconciled so they cannot overwrite the saved status.
 *
 * @param {SubmissionUploadReviewKeyScope} scope The review to update.
 * @returns The mutation; call `mutate` with the new status.
 */
export const useUpdateSubmissionUploadReviewStatusMutation = (scope: SubmissionUploadReviewKeyScope) => {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation<ISubmissionUploadReviewDetail, Error, ISubmissionUploadReviewDetail['status']>({
    mutationFn: (status) =>
      api.admin.updateSubmissionUploadReview(
        scope.submissionId,
        scope.submissionUploadId,
        scope.submissionUploadReviewId,
        status
      ),
    onSuccess: async (review) => {
      const reviewQueryKey = submissionUploadQueryKeys.reviewDetail(review.submission_upload_review_id);
      await queryClient.cancelQueries({ queryKey: reviewQueryKey, exact: true });
      queryClient.setQueryData(reviewQueryKey, review);
      void refreshChangedQueries(queryClient, changedQueryKeys.reviewStatus());
    }
  });
};
