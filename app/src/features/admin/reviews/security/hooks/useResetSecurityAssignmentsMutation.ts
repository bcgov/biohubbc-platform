import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import { holdReload, joinMutationGroup, refreshChangedQueries, settleMutationGroup } from 'utils/query-client';
import { changedQueryKeys } from 'utils/query-keys/changed-query-keys';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import {
  submissionUploadQueryKeys,
  SubmissionUploadReviewKeyScope
} from 'features/admin/reviews/submission-upload-query-keys';

/** The scope whose direct security assignments are cleared. */
export interface ResetSecurityAssignmentsVariables {
  /** Selected features; empty means the expression, or the whole upload. */
  selectedFeatureIds: number[];
  /** Applied expression, used only when no features are selected. */
  expression?: ExpressionTreeExpression;
}

/**
 * Clears every direct security assignment in the review's current scope.
 *
 * Once the review's last security change settles, every security-rule query for the review and every page of feature
 * results reload; the feature count is left alone, since security does not change which features match. The
 * submission's own pages are refreshed on success.
 *
 * @param {SubmissionUploadReviewKeyScope} scope The review whose assignments are cleared.
 * @returns The mutation; call `mutate` with {@link ResetSecurityAssignmentsVariables}.
 */
export const useResetSecurityAssignmentsMutation = (scope: SubmissionUploadReviewKeyScope) => {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation<void, Error, ResetSecurityAssignmentsVariables>({
    // Every security change in the review shares this key, so the reloads they need wait for the last of them.
    mutationKey: submissionUploadQueryKeys.securityRules(scope),
    onMutate: () => joinMutationGroup(queryClient, submissionUploadQueryKeys.securityRules(scope)),
    mutationFn: ({ selectedFeatureIds, expression }) =>
      api.admin.deleteSubmissionUploadReviewSecurityAssignments(
        scope.submissionId,
        scope.submissionUploadId,
        scope.submissionUploadReviewId,
        selectedFeatureIds,
        expression
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
    },
    onSettled: () => settleMutationGroup(queryClient, submissionUploadQueryKeys.securityRules(scope))
  });
};
