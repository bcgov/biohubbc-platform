import { QueryKey, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import {
  ISubmissionUploadReviewSelectedFeatureRule,
  ISubmissionUploadReviewSelectedFeatureRuleResponse
} from 'interfaces/useAdminApi.interface';
import {
  submissionUploadQueryKeys,
  SubmissionUploadReviewKeyScope
} from 'features/admin/reviews/submission-upload-query-keys';
import {
  cancelQueryForOptimisticUpdate,
  holdReload,
  joinMutationGroup,
  refreshChangedQueries,
  settleMutationGroup
} from 'utils/query-client';
import { changedQueryKeys } from 'utils/query-keys/changed-query-keys';

/** One Apply/Applied toggle on the review's rules grid. */
export interface ChangeSecurityRuleAssignmentVariables {
  /** The rule as the grid showed it when clicked; `applied` is the state being changed from. */
  rule: ISubmissionUploadReviewSelectedFeatureRule;
  /** Selected features the change applies to; empty means the expression, or the whole upload. */
  selectedFeatureIds: number[];
  /** Applied expression, used only when no features are selected. */
  expression?: ExpressionTreeExpression;
  /** Key of the rules grid the toggle was made in, so the optimistic row and its rollback land there. */
  rulesQueryKey: QueryKey;
}

interface ChangeSecurityRuleAssignmentContext {
  /** The optimistic row as cached; a later toggle or load of the row replaces this object. */
  optimisticRule: ISubmissionUploadReviewSelectedFeatureRule | undefined;
}

/**
 * Sets the applied state of the rows a predicate selects within a rules grid response.
 *
 * Rows the predicate rejects keep their identity, so the cache keeps them as they are.
 *
 * @param {ISubmissionUploadReviewSelectedFeatureRuleResponse | undefined} response The cached grid page.
 * @param {(row: ISubmissionUploadReviewSelectedFeatureRule) => boolean} isTarget Selects the rows to change.
 * @param {boolean} applied The applied state to write.
 * @returns {ISubmissionUploadReviewSelectedFeatureRuleResponse | undefined} The updated page, or undefined
 * when nothing is cached, which leaves the cache untouched.
 */
const setRuleApplied = (
  response: ISubmissionUploadReviewSelectedFeatureRuleResponse | undefined,
  isTarget: (row: ISubmissionUploadReviewSelectedFeatureRule) => boolean,
  applied: boolean
): ISubmissionUploadReviewSelectedFeatureRuleResponse | undefined => {
  if (!response) {
    return undefined;
  }
  return { ...response, rules: response.rules.map((row) => (isTarget(row) ? { ...row, applied } : row)) };
};

/**
 * Applies or removes one security rule for the review's current scope, flipping the rule in the rules grid
 * before the request completes.
 *
 * The rules grid is sorted applied-first, so it is not refetched after a successful toggle: the touched row
 * would jump to another position under the user's cursor. The optimistic row is the reconciled state. What
 * the toggle changes elsewhere, the features' security classification and each feature's own rule list, reloads
 * once the review's last security change settles: a reload started while another toggle is still being saved would
 * show the features without it. A load of the grid the toggle cancelled is repeated then too. The feature count is
 * left alone, since security does not change which features match.
 *
 * A failed toggle restores only its own row, and only while the cache still holds the very row object it
 * wrote. A newer toggle of the same rule, or a load of the grid, replaces that object, so neither is undone;
 * nor is a toggle of another rule, or a grid that has since moved to another scope under a different key.
 * Toggles overlap, so every failure is reported here: callbacks passed to `mutate` run for the latest call only.
 *
 * @param {SubmissionUploadReviewKeyScope} scope The review whose rules are changed.
 * @returns The mutation; call `mutate` with {@link ChangeSecurityRuleAssignmentVariables}.
 */
export const useChangeSecurityRuleAssignmentMutation = (scope: SubmissionUploadReviewKeyScope) => {
  const api = useApi();
  const queryClient = useQueryClient();
  const { setSnackbar } = useDialogContext();

  return useMutation<void, Error, ChangeSecurityRuleAssignmentVariables, ChangeSecurityRuleAssignmentContext>({
    // Every security change in the review shares this key, so the reloads they need wait for the last of them.
    mutationKey: submissionUploadQueryKeys.securityRules(scope),
    mutationFn: ({ rule, selectedFeatureIds, expression }) => {
      const request = rule.applied
        ? api.admin.deleteSubmissionUploadReviewSecurityRuleAssignments
        : api.admin.insertSubmissionUploadReviewSecurityRuleAssignments;
      return request(
        scope.submissionId,
        scope.submissionUploadId,
        scope.submissionUploadReviewId,
        selectedFeatureIds,
        rule.security_rule_id,
        expression
      );
    },
    onMutate: async ({ rule, rulesQueryKey }) => {
      joinMutationGroup(queryClient, submissionUploadQueryKeys.securityRules(scope));
      await cancelQueryForOptimisticUpdate(queryClient, rulesQueryKey, submissionUploadQueryKeys.securityRules(scope));
      const response = queryClient.setQueryData<ISubmissionUploadReviewSelectedFeatureRuleResponse>(
        rulesQueryKey,
        (current) => setRuleApplied(current, (row) => row.security_rule_id === rule.security_rule_id, !rule.applied)
      );
      const optimisticRule = response?.rules.find((row) => row.security_rule_id === rule.security_rule_id);
      return { optimisticRule };
    },
    onError: (error, { rule, rulesQueryKey }, context) => {
      setSnackbar({ open: true, snackbarMessage: error.message });
      queryClient.setQueryData<ISubmissionUploadReviewSelectedFeatureRuleResponse>(rulesQueryKey, (current) =>
        setRuleApplied(current, (row) => row === context?.optimisticRule, rule.applied)
      );
    },
    onSuccess: () => {
      const securityChanges = submissionUploadQueryKeys.securityRules(scope);
      holdReload(queryClient, securityChanges, submissionUploadQueryKeys.featureSearchResultsAll(scope), false);
      holdReload(queryClient, securityChanges, submissionUploadQueryKeys.featureRulesAll(scope), false);
      refreshChangedQueries(queryClient, changedQueryKeys.submissionSecurity(scope.submissionId));
    },
    onSettled: () => settleMutationGroup(queryClient, submissionUploadQueryKeys.securityRules(scope))
  });
};
