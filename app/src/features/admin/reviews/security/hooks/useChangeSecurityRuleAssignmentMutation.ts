import { hashKey, QueryKey, useQueryClient } from '@tanstack/react-query';
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
import { refreshChangedQueries } from 'utils/query-client';
import { useCoordinatedMutation, cancelQueryForOptimisticUpdate, holdReload } from 'hooks/useCoordinatedMutation';
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
  scope: SubmissionUploadReviewKeyScope;
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
 * The rules grid is sorted applied-first, so an isolated successful toggle does not refetch it: the touched row
 * would jump to another position under the user's cursor. The optimistic row is the reconciled state. What
 * the toggle changes elsewhere, the features' security classification and other cached rule views, reloads
 * once the review's last security change settles: a reload started while another toggle is still being saved would
 * show the features without it. A load of the grid the toggle cancelled is repeated then too. The feature count is
 * left alone, since security does not change which features match.
 *
 * A failed toggle restores only its own row, and only while the cache still holds the very row object it
 * wrote. A newer toggle of the same rule, or a load of the grid, replaces that object, so neither is undone;
 * nor is a toggle of another rule, or a grid that has since moved to another scope under a different key.
 * When the same row changes again before a request settles, reload it after the group settles: rollback snapshots
 * and response order cannot establish the final server state.
 * Toggles overlap, so every failure is reported here: callbacks passed to `mutate` run for the latest call only.
 *
 * @param {SubmissionUploadReviewKeyScope} scope The review whose rules are changed.
 * @returns The mutation; call `mutate` with {@link ChangeSecurityRuleAssignmentVariables}.
 */
export const useChangeSecurityRuleAssignmentMutation = (scope: SubmissionUploadReviewKeyScope) => {
  const api = useApi();
  const queryClient = useQueryClient();
  const { setSnackbar } = useDialogContext();

  return useCoordinatedMutation<
    void,
    Error,
    ChangeSecurityRuleAssignmentVariables,
    ChangeSecurityRuleAssignmentContext
  >({
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
      await cancelQueryForOptimisticUpdate(queryClient, rulesQueryKey, submissionUploadQueryKeys.securityRules(scope));
      const response = queryClient.setQueryData<ISubmissionUploadReviewSelectedFeatureRuleResponse>(
        rulesQueryKey,
        (current) => setRuleApplied(current, (row) => row.security_rule_id === rule.security_rule_id, !rule.applied)
      );
      const optimisticRule = response?.rules.find((row) => row.security_rule_id === rule.security_rule_id);
      return { optimisticRule, scope: { ...scope } };
    },
    onError: (error, { rule, rulesQueryKey }, context) => {
      setSnackbar({ open: true, snackbarMessage: error.message });
      const currentRule = queryClient
        .getQueryData<ISubmissionUploadReviewSelectedFeatureRuleResponse>(rulesQueryKey)
        ?.rules.find((row) => row.security_rule_id === rule.security_rule_id);
      if (context && currentRule !== context.optimisticRule) {
        holdReload(queryClient, submissionUploadQueryKeys.securityRules(context.scope), rulesQueryKey);
      }
      queryClient.setQueryData<ISubmissionUploadReviewSelectedFeatureRuleResponse>(rulesQueryKey, (current) =>
        setRuleApplied(current, (row) => row === context?.optimisticRule, rule.applied)
      );
    },
    onSuccess: async (_data, { rule, rulesQueryKey }, { scope, optimisticRule }) => {
      const securityChanges = submissionUploadQueryKeys.securityRules(scope);
      await cancelQueryForOptimisticUpdate(queryClient, rulesQueryKey, securityChanges);
      const currentRule = queryClient
        .getQueryData<ISubmissionUploadReviewSelectedFeatureRuleResponse>(rulesQueryKey)
        ?.rules.find((row) => row.security_rule_id === rule.security_rule_id);
      // Overlapping changes to this row can finish in either order. Reconcile once they all settle.
      if (currentRule !== optimisticRule) {
        holdReload(queryClient, securityChanges, rulesQueryKey);
      }
      holdReload(queryClient, securityChanges, submissionUploadQueryKeys.featureSearchResultsAll(scope), false);
      holdReload(queryClient, securityChanges, submissionUploadQueryKeys.featureRulesAll(scope), false);
      // Other selections and searches can show this rule too. Reconcile them after the group settles,
      // keeping the optimistically updated grid in place so its applied-first ordering does not jump.
      const otherRuleQueries = queryClient.getQueryCache().findAll({
        queryKey: submissionUploadQueryKeys.selectedFeatureRulesAll(scope),
        predicate: (query) => query.queryHash !== hashKey(rulesQueryKey)
      });
      for (const query of otherRuleQueries) {
        holdReload(queryClient, securityChanges, query.queryKey);
      }
      refreshChangedQueries(queryClient, changedQueryKeys.submissionSecurity(scope.submissionId));
    }
  });
};
