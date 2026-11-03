import { QueryKey, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { IGetTagRulesResponse, ITagRule } from 'interfaces/useTagRulesApi.interface';
import { refreshChangedQueries } from 'utils/query-client';
import { changedQueryKeys } from 'utils/query-keys/changed-query-keys';

/** Enabling or disabling one rule shown on a page of its tag's rule list. */
export interface UpdateTagRuleEnabledVariables {
  tagRule: ITagRule;
  isEnabled: boolean;
  /** The rule list page showing the rule, which shows the change before the request completes. */
  listQueryKey: QueryKey;
}

/**
 * Enables or disables a tag's rule, showing the new state on the rule list page before the request completes.
 *
 * Only the changed row is written, so overlapping changes to other rows on the page survive. On success the saved rule
 * replaces the row and the tag's other rule queries refresh; a failure restores the row's previous state and reports
 * the error.
 *
 * @param {string} tagId The tag whose rules are listed.
 * @returns The mutation; call `mutate` with {@link UpdateTagRuleEnabledVariables}.
 */
export const useUpdateTagRuleEnabledMutation = (tagId: string) => {
  const api = useApi();
  const queryClient = useQueryClient();
  const { setSnackbar } = useDialogContext();

  /**
   * Replaces one rule's row on a cached rule list page, leaving the page untouched when the rule is not on it.
   *
   * @param {QueryKey} listQueryKey The rule list page.
   * @param {string} tagRuleId The rule to replace.
   * @param {(tagRule: ITagRule) => ITagRule} update Returns the row's replacement.
   * @returns {void}
   */
  const updateListedTagRule = (listQueryKey: QueryKey, tagRuleId: string, update: (tagRule: ITagRule) => ITagRule) => {
    queryClient.setQueryData<IGetTagRulesResponse>(
      listQueryKey,
      (current) =>
        current && {
          ...current,
          tag_rules: current.tag_rules.map((row) => (row.tag_rule_id === tagRuleId ? update(row) : row))
        }
    );
  };

  return useMutation<ITagRule, Error, UpdateTagRuleEnabledVariables>({
    mutationFn: ({ tagRule, isEnabled }) =>
      api.tagRules.updateTagRuleEnabled(tagId, tagRule.tag_rule_id, { isEnabled }),
    onMutate: async ({ tagRule, isEnabled, listQueryKey }) => {
      // A list request already in flight would overwrite the optimistic row with the state before the change.
      await queryClient.cancelQueries({ queryKey: listQueryKey });
      updateListedTagRule(listQueryKey, tagRule.tag_rule_id, (row) => ({ ...row, is_enabled: isEnabled }));
    },
    onSuccess: (savedTagRule, { listQueryKey }) => {
      updateListedTagRule(listQueryKey, savedTagRule.tag_rule_id, () => savedTagRule);
      return refreshChangedQueries(queryClient, changedQueryKeys.tagRule(tagId), listQueryKey);
    },
    onError: (error, { tagRule, isEnabled, listQueryKey }) => {
      setSnackbar({ open: true, snackbarMessage: error.message });
      updateListedTagRule(listQueryKey, tagRule.tag_rule_id, (row) => ({ ...row, is_enabled: !isEnabled }));
    }
  });
};
