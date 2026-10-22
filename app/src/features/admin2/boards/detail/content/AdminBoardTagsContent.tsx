import { mdiPlus } from '@mdi/js';
import Icon from '@mdi/react';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QueryErrorDialog } from 'components/dialog/QueryErrorDialog';
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
import { refreshChangedQueries } from 'utils/query-client';
import { changedQueryKeys } from 'utils/query-keys/changed-query-keys';
import { tagQueryKeys } from 'utils/query-keys/tag-query-keys';
import { BoardTagAddDialog } from '../../dialog/BoardTagAddDialog';

interface IAdminBoardTagsContentProps {
  /** The board whose tags are listed. */
  boardId: string;
}

/**
 * Tags tab of a board's page: the server-paginated list of the board's tags. Applying one of them to a ticket, by hand
 * or by a tag rule, puts the ticket on the board, in its default lane. New Tag creates a regular tag linked to this
 * board; Add Tags links existing tags, which also puts the tickets that already have them on the board. A row's menu
 * unlinks its tag, which takes the tickets that have it off the board unless another of the board's tags keeps them
 * there; the tag itself is not affected. Tags are otherwise managed on the tickets
 * page's Tags tab.
 *
 * A save keeps the create dialog open and shows the server's error, such as a duplicate name, in the dialog.
 *
 * @param {IAdminBoardTagsContentProps} props The board whose tags are listed.
 * @returns {JSX.Element} The board's tags table.
 */
export const AdminBoardTagsContent = (props: IAdminBoardTagsContentProps) => {
  const { boardId } = props;
  const api = useApi();
  const queryClient = useQueryClient();
  const dialogContext = useDialogContext();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const grid = useServerPaginatedGridState({ defaultSort: { field: 'name', sort: 'asc' } });
  const listParams: ITagsQueryParams = { board_id: boardId, ...grid.apiPagination };
  const tagsQuery = useQuery({
    queryKey: tagQueryKeys.list(listParams),
    queryFn: ({ signal }) => api.tags.getTags(listParams, { signal }),
    placeholderData: keepPreviousData
  });

  const createBoardTagMutation = useMutation({
    mutationFn: (values: ITagFormValues) =>
      api.boards.createBoardTag(boardId, {
        name: values.name.trim(),
        description: values.description?.trim() || null,
        color: getTagColor(values.color)
      }),
    onSuccess: (createdTag) => {
      dialogContext.setSnackbar({ open: true, snackbarMessage: `Created tag ${createdTag.name}` });
      closeCreateDialog();
      void refreshChangedQueries(queryClient, changedQueryKeys.boardTag());
    }
  });

  const removeBoardTagMutation = useMutation({
    mutationFn: (tag: ITag) => api.boards.deleteBoardTag(boardId, tag.tag_id),
    onSuccess: (_data, tag) =>
      dialogContext.setSnackbar({ open: true, snackbarMessage: `Removed tag ${tag.name} from the board` }),
    onError: (error: Error) => dialogContext.setSnackbar({ open: true, snackbarMessage: error.message }),
    onSettled: () => refreshChangedQueries(queryClient, changedQueryKeys.boardTag())
  });
  const { mutate: removeBoardTag } = removeBoardTagMutation;

  /**
   * Asks for confirmation before unlinking a tag from the board, which takes the tickets that have it off the board
   * unless another of the board's tags keeps them there. The tag itself is not affected.
   *
   * @param {ITag} tag The tag to unlink.
   * @returns {void}
   */
  const handleRemoveTag = useCallback(
    (tag: ITag) => {
      const closeConfirmation = () => dialogContext.setYesNoDialog({ open: false });

      dialogContext.setYesNoDialog({
        open: true,
        dialogTitle: 'Remove tag from board?',
        dialogContent: (
          <Typography component="div" color="textSecondary">
            Tickets with tag <strong>{tag.name}</strong> are taken off this board, unless another of the board&apos;s
            tags keeps them on it. The tag itself is not affected.
          </Typography>
        ),
        yesButtonLabel: 'Remove',
        noButtonLabel: 'Cancel',
        yesButtonProps: { color: 'error' },
        onClose: closeConfirmation,
        onNo: closeConfirmation,
        onYes: () => {
          closeConfirmation();
          removeBoardTag(tag);
        }
      });
    },
    [dialogContext, removeBoardTag]
  );

  /**
   * Closes the create dialog and forgets its last error.
   *
   * @returns {void}
   */
  const closeCreateDialog = () => {
    setIsCreateDialogOpen(false);
    createBoardTagMutation.reset();
  };

  const rowCount = tagsQuery.data?.pagination.total ?? 0;

  return (
    <>
      <QueryErrorDialog error={tagsQuery.error} label="board tags" />
      <PageSection
        id="board-tags"
        label={
          <>
            Tags{' '}
            <Typography sx={{ fontSize: 'inherit' }} component="span" color="textSecondary">
              ({rowCount})
            </Typography>
          </>
        }
        onAdd={() => setIsCreateDialogOpen(true)}
        addLabel="New Tag"
        headerContent={
          <Button
            variant="outlined"
            startIcon={<Icon path={mdiPlus} size={0.8} />}
            onClick={() => setIsAddDialogOpen(true)}>
            Add Tags
          </Button>
        }>
        <AdminTagsTable
          tags={tagsQuery.data?.tags ?? []}
          rowCount={rowCount}
          paginationModel={grid.paginationModel}
          setPaginationModel={grid.handlePaginationChange}
          sortModel={grid.sortModel}
          setSortModel={grid.handleSortChange}
          onRemoveTag={handleRemoveTag}
        />
      </PageSection>
      <TagDialog
        open={isCreateDialogOpen}
        isLoading={createBoardTagMutation.isPending}
        dialogError={createBoardTagMutation.error?.message}
        onCancel={closeCreateDialog}
        onSave={(values) => createBoardTagMutation.mutate(values)}
      />
      <BoardTagAddDialog open={isAddDialogOpen} boardId={boardId} onClose={() => setIsAddDialogOpen(false)} />
    </>
  );
};
