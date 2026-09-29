import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import { ISubmissionUploadReviewDetail } from 'interfaces/useAdminApi.interface';
import {
  submissionUploadQueryKeys,
  SubmissionUploadReviewKeyScope
} from 'features/admin/reviews/submission-upload-query-keys';

/**
 * Completes or reopens a review, writing the updated review into the review detail query.
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
    onSuccess: (review) => {
      queryClient.setQueryData(submissionUploadQueryKeys.reviewDetail(scope), review);
    }
  });
};
