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
import { ITagsQueryParams } from 'interfaces/useTagsApi.interface';
import { useState } from 'react';
import { refreshChangedQueries } from 'utils/query-client';
import { changedQueryKeys } from 'utils/query-keys/changed-query-keys';
import { tagQueryKeys } from 'utils/query-keys/tag-query-keys';

interface IAdminBoardTagsContentProps {
  /** The board whose tags are listed. */
  boardId: string;
}

/**
 * Tags tab of a board's page: the server-paginated list of the board's tags, which decide the tickets on the board.
 * A new tag can be created here: it is a regular tag, added to this board. Tags are otherwise managed on the tickets
 * page's Tags tab, and the board's tags are changed by editing the board.
 *
 * A save keeps the dialog open and shows the server's error, such as a duplicate name, in the dialog.
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
      void refreshChangedQueries(queryClient, changedQueryKeys.board());
    }
  });

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
        addLabel="New Tag">
        <AdminTagsTable
          tags={tagsQuery.data?.tags ?? []}
          rowCount={rowCount}
          paginationModel={grid.paginationModel}
          setPaginationModel={grid.handlePaginationChange}
          sortModel={grid.sortModel}
          setSortModel={grid.handleSortChange}
        />
      </PageSection>
      <TagDialog
        open={isCreateDialogOpen}
        isLoading={createBoardTagMutation.isPending}
        dialogError={createBoardTagMutation.error?.message}
        onCancel={closeCreateDialog}
        onSave={(values) => createBoardTagMutation.mutate(values)}
      />
    </>
  );
};
