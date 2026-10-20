import Typography from '@mui/material/Typography';
import { keepPreviousData, skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QueryErrorDialog } from 'components/dialog/QueryErrorDialog';
import { PageSection } from 'components/section/PageSection';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { useServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import { ITagRule, ITagRuleDetail, ITagRuleRequest } from 'interfaces/useTagRulesApi.interface';
import { useCallback, useMemo, useState } from 'react';
import { refreshChangedQueries } from 'utils/query-client';
import { changedQueryKeys } from 'utils/query-keys/changed-query-keys';
import { tagQueryKeys } from 'utils/query-keys/tag-query-keys';
import { TagRuleDeleteDialog } from '../../dialog/TagRuleDeleteDialog';
import { TagRuleDialog } from '../../dialog/TagRuleDialog';
import { ITagRuleFormValues } from '../../form/TagRuleForm';
import { useUpdateTagRuleEnabledMutation } from '../../hooks/useUpdateTagRuleEnabledMutation';
import { AdminTagRulesTable } from '../../table/AdminTagRulesTable';

interface IAdminTagRulesContentProps {
  /** The tag whose rules are listed. */
  tagId: string;
}

/**
 * Rules tab of a tag's page: the server-paginated list of the rules that apply the tag, with create, edit, enable or
 * disable, and delete.
 *
 * Editing loads the rule's expression first and opens the dialog once it has loaded, since the expression builder
 * reads its value only when it mounts. A save keeps its dialog open and shows the server's error, such as a duplicate
 * name, in the dialog. Enabling or disabling shows the new state at once and restores it if the change fails.
 * Deleting a rule can also remove the tags it applied, which its confirmation offers.
 *
 * @param {IAdminTagRulesContentProps} props The tag whose rules are listed.
 * @returns {JSX.Element} The tag's rules table and its dialogs.
 */
export const AdminTagRulesContent = (props: IAdminTagRulesContentProps) => {
  const { tagId } = props;
  const api = useApi();
  const queryClient = useQueryClient();
  const dialogContext = useDialogContext();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingTagRule, setEditingTagRule] = useState<ITagRule | undefined>();
  const [deletingTagRule, setDeletingTagRule] = useState<ITagRule | undefined>();

  const grid = useServerPaginatedGridState({ defaultSort: { field: 'name', sort: 'asc' } });
  const listQueryKey = useMemo(() => tagQueryKeys.ruleList(tagId, grid.apiPagination), [tagId, grid.apiPagination]);
  const tagRulesQuery = useQuery({
    queryKey: listQueryKey,
    queryFn: ({ signal }) => api.tagRules.getTagRules(tagId, grid.apiPagination, { signal }),
    placeholderData: keepPreviousData
  });

  const editingTagRuleId = editingTagRule?.tag_rule_id;
  const editingTagRuleQuery = useQuery({
    queryKey: tagQueryKeys.ruleDetail(tagId, editingTagRuleId ?? ''),
    queryFn: editingTagRuleId ? ({ signal }) => api.tagRules.getTagRule(tagId, editingTagRuleId, { signal }) : skipToken
  });

  const saveTagRuleMutation = useMutation({
    mutationFn: ({ tagRuleId, values }: { tagRuleId: string | undefined; values: ITagRuleFormValues }) => {
      if (!values.expression) {
        throw new Error('Expression is required');
      }

      const payload: ITagRuleRequest = {
        name: values.name.trim(),
        description: values.description?.trim() || null,
        expression: values.expression
      };

      if (tagRuleId) {
        return api.tagRules.updateTagRule(tagId, tagRuleId, payload);
      }

      return api.tagRules.createTagRule(tagId, payload);
    },
    onSuccess: (savedTagRule, { tagRuleId }) => {
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: tagRuleId ? `Updated rule ${savedTagRule.name}` : `Created rule ${savedTagRule.name}`
      });
      closeTagRuleDialog();

      const detailQueryKey = tagQueryKeys.ruleDetail(tagId, savedTagRule.tag_rule_id);
      queryClient.setQueryData<ITagRuleDetail>(detailQueryKey, savedTagRule);

      // A new rule applies only to tickets evaluated after it; an edited rule's name shows on the tags it applied.
      const changedKeys = tagRuleId ? changedQueryKeys.tagRuleApplied(tagId) : changedQueryKeys.tagRule(tagId);
      void refreshChangedQueries(queryClient, changedKeys, detailQueryKey);
    }
  });

  const deleteTagRuleMutation = useMutation({
    mutationFn: ({ tagRule, removeTags }: { tagRule: ITagRule; removeTags: boolean }) =>
      api.tagRules.deleteTagRule(tagId, tagRule.tag_rule_id, removeTags),
    onSuccess: (_data, { tagRule }) => {
      dialogContext.setSnackbar({ open: true, snackbarMessage: `Deleted rule ${tagRule.name}` });
      void refreshChangedQueries(queryClient, changedQueryKeys.tagRuleApplied(tagId));
    },
    onError: (error: Error) => dialogContext.setSnackbar({ open: true, snackbarMessage: error.message })
  });

  const { mutate: updateTagRuleEnabled } = useUpdateTagRuleEnabledMutation(tagId);

  /**
   * Closes the create or edit dialog, forgetting the rule it was editing and its last error.
   *
   * @returns {void}
   */
  const closeTagRuleDialog = () => {
    setIsCreateDialogOpen(false);
    setEditingTagRule(undefined);
    saveTagRuleMutation.reset();
  };

  /**
   * Saves the dialog's rule: updates the rule being edited, or creates one.
   *
   * @param {ITagRuleFormValues} values The dialog's validated values.
   * @returns {void}
   */
  const handleSaveTagRule = (values: ITagRuleFormValues) => {
    saveTagRuleMutation.mutate({ tagRuleId: editingTagRuleId, values });
  };

  /**
   * Enables a disabled rule, or disables an enabled one, on the page showing it.
   *
   * @param {ITagRule} tagRule The rule to change.
   * @returns {void}
   */
  const handleToggleTagRuleEnabled = useCallback(
    (tagRule: ITagRule) => updateTagRuleEnabled({ tagRule, isEnabled: !tagRule.is_enabled, listQueryKey }),
    [updateTagRuleEnabled, listQueryKey]
  );

  const rowCount = tagRulesQuery.data?.pagination.total ?? 0;

  return (
    <>
      <QueryErrorDialog error={tagRulesQuery.error} label="tag rules" />
      <QueryErrorDialog error={editingTagRuleQuery.error} label="tag rule" />
      <PageSection
        id="tag-rules"
        label={
          <>
            Rules{' '}
            <Typography sx={{ fontSize: 'inherit' }} component="span" color="textSecondary">
              ({rowCount})
            </Typography>
          </>
        }
        onAdd={() => setIsCreateDialogOpen(true)}
        addLabel="New Rule">
        <AdminTagRulesTable
          tagRules={tagRulesQuery.data?.tag_rules ?? []}
          rowCount={rowCount}
          paginationModel={grid.paginationModel}
          setPaginationModel={grid.handlePaginationChange}
          sortModel={grid.sortModel}
          setSortModel={grid.handleSortChange}
          onEditTagRule={setEditingTagRule}
          onToggleTagRuleEnabled={handleToggleTagRuleEnabled}
          onDeleteTagRule={setDeletingTagRule}
        />
      </PageSection>

      <TagRuleDialog
        open={isCreateDialogOpen}
        isLoading={saveTagRuleMutation.isPending}
        dialogError={saveTagRuleMutation.error?.message}
        onCancel={closeTagRuleDialog}
        onSave={handleSaveTagRule}
      />

      {editingTagRule && editingTagRuleQuery.data && (
        <TagRuleDialog
          open
          tagRule={editingTagRuleQuery.data}
          isLoading={saveTagRuleMutation.isPending}
          dialogError={saveTagRuleMutation.error?.message}
          onCancel={closeTagRuleDialog}
          onSave={handleSaveTagRule}
        />
      )}

      <TagRuleDeleteDialog
        tagRule={deletingTagRule}
        onCancel={() => setDeletingTagRule(undefined)}
        onDelete={(tagRule, removeTags) => {
          setDeletingTagRule(undefined);
          deleteTagRuleMutation.mutate({ tagRule, removeTags });
        }}
      />
    </>
  );
};
