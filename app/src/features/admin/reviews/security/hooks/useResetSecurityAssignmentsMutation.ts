import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
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
 * On success every security-rule query for the review and every page of feature results is invalidated.
 * The feature count is left alone, since security does not change which features match.
 *
 * @param {SubmissionUploadReviewKeyScope} scope The review whose assignments are cleared.
 * @returns The mutation; call `mutate` with {@link ResetSecurityAssignmentsVariables}.
 */
export const useResetSecurityAssignmentsMutation = (scope: SubmissionUploadReviewKeyScope) => {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation<void, Error, ResetSecurityAssignmentsVariables>({
    mutationFn: ({ selectedFeatureIds, expression }) =>
      api.admin.deleteSubmissionUploadReviewSecurityAssignments(
        scope.submissionId,
        scope.submissionUploadId,
        scope.submissionUploadReviewId,
        selectedFeatureIds,
        expression
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: submissionUploadQueryKeys.securityRules(scope) });
      void queryClient.invalidateQueries({ queryKey: submissionUploadQueryKeys.featureSearchResultsAll(scope) });
    }
  });
};
