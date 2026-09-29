import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import {
  submissionUploadQueryKeys,
  SubmissionUploadReviewKeyScope
} from 'features/admin/reviews/submission-upload-query-keys';

/** The direct assignment removed from one feature. */
export interface RemoveFeatureSecurityRuleVariables {
  submissionFeatureId: number;
  securityRuleId: number;
}

/**
 * Removes one direct security rule from one feature.
 *
 * On success every security-rule query for the review and every page of feature results is invalidated.
 * The feature count is left alone, since security does not change which features match.
 *
 * @param {SubmissionUploadReviewKeyScope} scope The review the feature belongs to.
 * @returns The mutation; call `mutate` with {@link RemoveFeatureSecurityRuleVariables}.
 */
export const useRemoveFeatureSecurityRuleMutation = (scope: SubmissionUploadReviewKeyScope) => {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation<void, Error, RemoveFeatureSecurityRuleVariables>({
    mutationFn: ({ submissionFeatureId, securityRuleId }) =>
      api.admin.deleteSubmissionUploadReviewSecurityRuleAssignments(
        scope.submissionId,
        scope.submissionUploadId,
        scope.submissionUploadReviewId,
        [submissionFeatureId],
        securityRuleId
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: submissionUploadQueryKeys.securityRules(scope) });
      void queryClient.invalidateQueries({ queryKey: submissionUploadQueryKeys.featureSearchResultsAll(scope) });
    }
  });
};
