import Alert from '@mui/material/Alert';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QueryErrorDialog } from 'components/dialog/QueryErrorDialog';
import { PageSection } from 'components/section/PageSection';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { ITagRule } from 'interfaces/useTagRulesApi.interface';
import { AdminPageLayout } from 'layouts/AdminPageLayout';
import { useCallback, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { refreshChangedQueries } from 'utils/query-client';
import { changedQueryKeys } from 'utils/query-keys/changed-query-keys';
import { tagQueryKeys } from 'utils/query-keys/tag-query-keys';
import { TagRuleDeleteDialog } from './dialog/TagRuleDeleteDialog';
import { AdminTagRulesTable } from './table/AdminTagRulesTable';

/**
 * Administrative tag rules page: the list of rules that apply tags to tickets, with create, edit and delete.
 *
 * A rule is a tag plus an expression. Rules tag tickets when a data request is created or a submission upload
 * finishes processing; they only add tags, never one the ticket has ever had, and new rules do not apply to existing
 * tickets. Deleting a rule can also remove the tags it applied, which its confirmation offers.
 *
 * @returns {JSX.Element} The tag rules page.
 */
export const AdminTagRulesPage = () => {
  const api = useApi();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const dialogContext = useDialogContext();
  const [deletingTagRule, setDeletingTagRule] = useState<ITagRule | undefined>();

  const tagRulesQuery = useQuery({
    queryKey: tagQueryKeys.ruleList(),
    queryFn: ({ signal }) => api.tagRules.getTagRules({ signal })
  });

  const deleteTagRuleMutation = useMutation({
    mutationFn: ({ tagRule, removeTags }: { tagRule: ITagRule; removeTags: boolean }) =>
      api.tagRules.deleteTagRule(tagRule.tag_rule_id, removeTags),
    onSuccess: (_data, { tagRule }) => {
      dialogContext.setSnackbar({ open: true, snackbarMessage: `Deleted tag rule ${tagRule.name}` });
      void refreshChangedQueries(queryClient, changedQueryKeys.tagRule());
    },
    onError: (error: Error) => dialogContext.setSnackbar({ open: true, snackbarMessage: error.message })
  });

  const handleEditTagRule = useCallback(
    (tagRule: ITagRule) => navigate(`/admin/tag-rules/${tagRule.tag_rule_id}`),
    [navigate]
  );

  const tagRules = tagRulesQuery.data?.tag_rules ?? [];

  return (
    <>
      <AdminPageLayout
        title="Tag Rules"
        breadcrumbs={
          <Breadcrumbs aria-label="tag rules breadcrumb">
            <Link component={RouterLink} to="/admin" underline="hover" color="inherit">
              Administration
            </Link>
            <Typography variant="inherit" color="text.primary" aria-current="page">
              Tag Rules
            </Typography>
          </Breadcrumbs>
        }
        tabs={[{ value: 'tag-rules', label: 'Tag Rules', id: 'tag-rules-tab', ariaControls: 'tag-rules-panel' }]}
        activeTab="tag-rules"
        onTabChange={() => {}}>
        <Stack id="tag-rules-panel" role="tabpanel" aria-labelledby="tag-rules-tab" gap={3}>
          <QueryErrorDialog error={tagRulesQuery.error} label="tag rules" />
          <Alert severity="info">
            Rules tag tickets when a data request is created or a submission upload finishes processing: an upload
            ticket when a feature of the upload matches the rule&apos;s expression, and a data request ticket when the
            request&apos;s search refers to a property or taxon the expression also refers to. Rules only add tags,
            never re-add a tag that was removed from a ticket, and new rules don&apos;t apply to existing tickets.
          </Alert>
          <PageSection
            id="tag-rules"
            label={
              <>
                Tag Rules{' '}
                <Typography sx={{ fontSize: 'inherit' }} component="span" color="textSecondary">
                  ({tagRules.length})
                </Typography>
              </>
            }
            onAdd={() => navigate('/admin/tag-rules/new')}
            addLabel="New Tag Rule">
            <AdminTagRulesTable
              tagRules={tagRules}
              isLoading={tagRulesQuery.isPending}
              onEditTagRule={handleEditTagRule}
              onDeleteTagRule={setDeletingTagRule}
            />
          </PageSection>
        </Stack>
      </AdminPageLayout>

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
