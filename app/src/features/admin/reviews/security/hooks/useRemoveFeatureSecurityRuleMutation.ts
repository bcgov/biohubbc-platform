import { useQueryClient } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import { refreshChangedQueries } from 'utils/query-client';
import { useCoordinatedMutation, holdReload } from 'hooks/useCoordinatedMutation';
import { changedQueryKeys } from 'utils/query-keys/changed-query-keys';
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
 * Once the review's last security change settles, every security-rule query for the review and every page of feature
 * results reload; the feature count is left alone, since security does not change which features match. The
 * submission's own pages are refreshed on success.
 *
 * @param {SubmissionUploadReviewKeyScope} scope The review the feature belongs to.
 * @returns The mutation; call `mutate` with {@link RemoveFeatureSecurityRuleVariables}.
 */
export const useRemoveFeatureSecurityRuleMutation = (scope: SubmissionUploadReviewKeyScope) => {
  const api = useApi();
  const queryClient = useQueryClient();

  return useCoordinatedMutation<void, Error, RemoveFeatureSecurityRuleVariables>({
    // Every security change in the review shares this key, so the reloads they need wait for the last of them.
    mutationKey: submissionUploadQueryKeys.securityRules(scope),
    mutationFn: ({ submissionFeatureId, securityRuleId }) =>
      api.admin.deleteSubmissionUploadReviewSecurityRuleAssignments(
        scope.submissionId,
        scope.submissionUploadId,
        scope.submissionUploadReviewId,
        [submissionFeatureId],
        securityRuleId
      ),
    onSuccess: () => {
      // Held until the review's last security change settles, so a reload never lands between two changes.
      holdReload(
        queryClient,
        submissionUploadQueryKeys.securityRules(scope),
        submissionUploadQueryKeys.securityRules(scope),
        false
      );
      holdReload(
        queryClient,
        submissionUploadQueryKeys.securityRules(scope),
        submissionUploadQueryKeys.featureSearchResultsAll(scope),
        false
      );
      refreshChangedQueries(queryClient, changedQueryKeys.submissionSecurity(scope.submissionId));
    }
  });
};
