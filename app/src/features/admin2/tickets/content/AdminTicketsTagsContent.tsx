import Typography from '@mui/material/Typography';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QueryErrorDialog } from 'components/dialog/QueryErrorDialog';
import SearchTextField from 'components/fields/SearchTextField';
import { PageSection } from 'components/section/PageSection';
import { TagDialog } from 'features/admin2/tags/dialog/TagDialog';
import { getTagColor } from 'features/admin2/tags/form/tag-color';
import { ITagFormValues } from 'features/admin2/tags/form/TagForm';
import { AdminTagsTable } from 'features/admin2/tags/table/AdminTagsTable';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { useServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import { ITag, ITagsQueryParams } from 'interfaces/useTagsApi.interface';
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { refreshChangedQueries } from 'utils/query-client';
import { changedQueryKeys } from 'utils/query-keys/changed-query-keys';
import { tagQueryKeys } from 'utils/query-keys/tag-query-keys';

/**
 * Tags tab of the administrative tickets page: the searchable, server-paginated list of ticket tags, with create,
 * edit and delete. Each tag opens its own page, which lists the rules that apply it.
 *
 * A save keeps its dialog open and shows the server's error, such as a duplicate name, in the dialog. Deleting a tag
 * removes it from every ticket, so its confirmation says so; tag changes refresh everything that shows tags.
 *
 * @returns {JSX.Element} The tags table and its dialogs.
 */
export const AdminTicketsTagsContent = () => {
  const api = useApi();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const dialogContext = useDialogContext();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<ITag | undefined>();

  const grid = useServerPaginatedGridState({ defaultSort: { field: 'name', sort: 'asc' } });
  const listParams: ITagsQueryParams = { search: grid.debouncedSearchTerm, ...grid.apiPagination };
  const tagsQuery = useQuery({
    queryKey: tagQueryKeys.list(listParams),
    queryFn: ({ signal }) => api.tags.getTags(listParams, { signal }),
    placeholderData: keepPreviousData
  });

  /**
   * Closes the tag dialog and forgets the tag it was editing and its last error.
   *
   * @returns {void}
   */
  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingTag(undefined);
    saveTagMutation.reset();
  };

  const saveTagMutation = useMutation({
    mutationFn: ({ tag, values }: { tag: ITag | undefined; values: ITagFormValues }) => {
      const payload = {
        name: values.name.trim(),
        description: values.description?.trim() || null,
        color: getTagColor(values.color)
      };

      if (tag) {
        return api.tags.updateTag(tag.tag_id, payload);
      }

      return api.tags.createTag(payload);
    },
    onSuccess: (savedTag, { tag }) => {
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: tag ? `Updated tag ${savedTag.name}` : `Created tag ${savedTag.name}`
      });
      closeDialog();
      void refreshChangedQueries(queryClient, changedQueryKeys.tag());
    }
  });

  const deleteTagMutation = useMutation({
    mutationFn: (tag: ITag) => api.tags.deleteTag(tag.tag_id),
    onSuccess: (_data, tag) => {
      dialogContext.setSnackbar({ open: true, snackbarMessage: `Deleted tag ${tag.name}` });
      void refreshChangedQueries(queryClient, changedQueryKeys.tag());
    },
    onError: (error: Error) => dialogContext.setSnackbar({ open: true, snackbarMessage: error.message })
  });
  const { mutate: deleteTag } = deleteTagMutation;

  const handleEditTag = useCallback((tag: ITag) => {
    setEditingTag(tag);
    setIsDialogOpen(true);
  }, []);

  /**
   * Asks for confirmation before deleting a tag, which also removes it from every ticket.
   *
   * @param {ITag} tag The tag to delete.
   * @returns {void}
   */
  const handleDeleteTag = useCallback(
    (tag: ITag) => {
      const closeConfirmation = () => dialogContext.setYesNoDialog({ open: false });

      dialogContext.setYesNoDialog({
        open: true,
        dialogTitle: 'Delete tag?',
        dialogContent: (
          <Typography component="div" color="textSecondary">
            Deleting tag <strong>{tag.name}</strong> removes it from all tickets. This cannot be undone. Are you sure
            you want to proceed?
          </Typography>
        ),
        yesButtonLabel: 'Delete Tag',
        noButtonLabel: 'Cancel',
        yesButtonProps: { color: 'error' },
        onClose: closeConfirmation,
        onNo: closeConfirmation,
        onYes: () => {
          closeConfirmation();
          deleteTag(tag);
        }
      });
    },
    [deleteTag, dialogContext]
  );

  const rowCount = tagsQuery.data?.pagination.total ?? 0;

  return (
    <>
      <QueryErrorDialog error={tagsQuery.error} label="tags" />
      <PageSection
        id="tags"
        label={
          <>
            Tags{' '}
            <Typography sx={{ fontSize: 'inherit' }} component="span" color="textSecondary">
              ({rowCount})
            </Typography>
          </>
        }
        onAdd={() => setIsDialogOpen(true)}
        addLabel="New Tag"
        headerContent={
          <SearchTextField
            size="small"
            placeholder="Search by tag name"
            value={grid.searchTerm}
            onChange={(event) => grid.handleSearch(event.target.value)}
          />
        }>
        <AdminTagsTable
          tags={tagsQuery.data?.tags ?? []}
          rowCount={rowCount}
          paginationModel={grid.paginationModel}
          setPaginationModel={grid.handlePaginationChange}
          sortModel={grid.sortModel}
          setSortModel={grid.handleSortChange}
          onEditTag={handleEditTag}
          onDeleteTag={handleDeleteTag}
          onOpenTag={(tag) => navigate(`/admin/tickets/tags/${tag.tag_id}`)}
        />
      </PageSection>

      <TagDialog
        open={isDialogOpen}
        tag={editingTag}
        isLoading={saveTagMutation.isPending}
        dialogError={saveTagMutation.error?.message}
        onCancel={closeDialog}
        onSave={(values) => saveTagMutation.mutate({ tag: editingTag, values })}
      />
    </>
  );
};
