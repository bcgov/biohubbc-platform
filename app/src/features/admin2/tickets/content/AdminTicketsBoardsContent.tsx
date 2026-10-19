import { mdiDotsVertical, mdiPencil, mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { GridColDef } from '@mui/x-data-grid';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ServerPaginatedDataGrid } from 'components/data-grid/ServerPaginatedDataGrid';
import { QueryErrorDialog } from 'components/dialog/QueryErrorDialog';
import SearchTextField from 'components/fields/SearchTextField';
import { PageSection } from 'components/section/PageSection';
import { TagChip } from 'components/tags/TagChip';
import { CustomMenuIconButton } from 'components/toolbar/ActionToolbars';
import { BoardDialog } from 'features/admin2/boards/dialog/BoardDialog';
import { IBoardFormValues } from 'features/admin2/boards/form/BoardForm';
import { useSaveBoardMutation } from 'features/admin2/boards/hooks/useSaveBoardMutation';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { useServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import { IBoardSummary, IBoardsQueryParams } from 'interfaces/useBoardsApi.interface';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { refreshChangedQueries } from 'utils/query-client';
import { boardQueryKeys } from 'utils/query-keys/board-query-keys';
import { changedQueryKeys } from 'utils/query-keys/changed-query-keys';
import { getRelativeTimeLabel } from 'utils/date';

/**
 * Boards tab of the administrative tickets page: the searchable, server-paginated list of ticket boards, with create,
 * edit and delete. Each board opens its own page, which lists the tickets with any of its tags.
 *
 * A save keeps its dialog open and shows the server's error, such as a duplicate name, in the dialog.
 *
 * @returns {JSX.Element} The boards table and its dialogs.
 */
export const AdminTicketsBoardsContent = () => {
  const api = useApi();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const dialogContext = useDialogContext();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBoard, setEditingBoard] = useState<IBoardSummary | undefined>();

  const grid = useServerPaginatedGridState({ defaultSort: { field: 'name', sort: 'asc' } });
  const listParams: IBoardsQueryParams = { search: grid.debouncedSearchTerm, ...grid.apiPagination };
  const boardsQuery = useQuery({
    queryKey: boardQueryKeys.list(listParams),
    queryFn: ({ signal }) => api.boards.getBoards(listParams, { signal }),
    placeholderData: keepPreviousData
  });
  const saveBoardMutation = useSaveBoardMutation();
  const deleteBoardMutation = useMutation({
    mutationFn: (board: IBoardSummary) => api.boards.deleteBoard(board.board_id),
    onSuccess: (_data, board) => {
      dialogContext.setSnackbar({ open: true, snackbarMessage: `Deleted board ${board.name}` });
      void refreshChangedQueries(queryClient, changedQueryKeys.board());
    },
    onError: (error: Error) => dialogContext.setSnackbar({ open: true, snackbarMessage: error.message })
  });
  const { mutate: deleteBoard } = deleteBoardMutation;

  /**
   * Closes the board dialog and clears the board it was editing and its last error.
   *
   * @returns {void}
   */
  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingBoard(undefined);
    saveBoardMutation.reset();
  };

  /**
   * Saves the dialog's board, closing the dialog once saved; a failure stays in the dialog.
   *
   * @param {IBoardFormValues} values The dialog's values.
   * @returns {void}
   */
  const handleSaveBoard = (values: IBoardFormValues) => {
    saveBoardMutation.mutate(
      { boardId: editingBoard?.board_id, values },
      {
        onSuccess: (savedBoard) => {
          dialogContext.setSnackbar({
            open: true,
            snackbarMessage: editingBoard ? `Updated board ${savedBoard.name}` : `Created board ${savedBoard.name}`
          });
          closeDialog();
        }
      }
    );
  };

  const handleEditBoard = useCallback((board: IBoardSummary) => {
    setEditingBoard(board);
    setIsDialogOpen(true);
  }, []);

  /**
   * Asks for confirmation before deleting a board. Tickets and tags are not affected.
   *
   * @param {IBoardSummary} board The board to delete.
   * @returns {void}
   */
  const handleDeleteBoard = useCallback(
    (board: IBoardSummary) => {
      const closeConfirmation = () => dialogContext.setYesNoDialog({ open: false });

      dialogContext.setYesNoDialog({
        open: true,
        dialogTitle: 'Delete board?',
        dialogContent: (
          <Typography component="div" color="textSecondary">
            Deleting board <strong>{board.name}</strong> does not affect its tickets or tags. Are you sure you want to
            proceed?
          </Typography>
        ),
        yesButtonLabel: 'Delete Board',
        noButtonLabel: 'Cancel',
        yesButtonProps: { color: 'error' },
        onClose: closeConfirmation,
        onNo: closeConfirmation,
        onYes: () => {
          closeConfirmation();
          deleteBoard(board);
        }
      });
    },
    [deleteBoard, dialogContext]
  );

  const columns: GridColDef<IBoardSummary>[] = useMemo(
    () => [
      {
        field: 'name',
        headerName: 'Board',
        minWidth: 200,
        flex: 1,
        renderCell: (params) => (
          <Typography variant="body2" noWrap title={params.row.name}>
            {params.row.name}
          </Typography>
        )
      },
      {
        field: 'description',
        headerName: 'Description',
        minWidth: 240,
        flex: 1.5,
        sortable: false,
        renderCell: (params) => (
          <Typography variant="body2" noWrap title={params.row.description ?? ''} color="text.secondary">
            {params.row.description}
          </Typography>
        )
      },
      {
        field: 'tags',
        headerName: 'Tags',
        minWidth: 200,
        flex: 1.5,
        sortable: false,
        renderCell: (params) => (
          <Stack direction="row" gap={0.5} alignItems="center" sx={{ height: '100%', overflow: 'hidden' }}>
            {params.row.tags.map((tag) => (
              <TagChip key={tag.tag_id} tag={tag} />
            ))}
          </Stack>
        )
      },
      {
        field: 'create_date',
        headerName: 'Created',
        minWidth: 140,
        flex: 0.8,
        renderCell: (params) => (
          <Typography variant="body2" noWrap title={params.row.create_date}>
            {getRelativeTimeLabel(params.row.create_date)}
          </Typography>
        )
      },
      {
        field: 'actions',
        headerName: 'Actions',
        minWidth: 100,
        flex: 0.5,
        sortable: false,
        align: 'center',
        headerAlign: 'center',
        renderCell: (params) => (
          <Box onClick={(event) => event.stopPropagation()}>
            <CustomMenuIconButton
              buttonTitle="Actions"
              buttonIcon={<Icon path={mdiDotsVertical} size={1} />}
              menuItems={[
                {
                  menuIcon: <Icon path={mdiPencil} size={0.875} />,
                  menuLabel: 'Edit board',
                  menuOnClick: () => handleEditBoard(params.row)
                },
                {
                  menuIcon: <Icon path={mdiTrashCanOutline} size={0.875} />,
                  menuLabel: 'Delete board',
                  menuOnClick: () => handleDeleteBoard(params.row)
                }
              ]}
            />
          </Box>
        )
      }
    ],
    [handleDeleteBoard, handleEditBoard]
  );

  const rowCount = boardsQuery.data?.pagination.total ?? 0;

  return (
    <>
      <QueryErrorDialog error={boardsQuery.error} label="boards" />
      <PageSection
        id="boards"
        label={
          <>
            Boards{' '}
            <Typography sx={{ fontSize: 'inherit' }} component="span" color="textSecondary">
              ({rowCount})
            </Typography>
          </>
        }
        onAdd={() => setIsDialogOpen(true)}
        addLabel="New Board"
        headerContent={
          <SearchTextField
            size="small"
            placeholder="Search by board name"
            value={grid.searchTerm}
            onChange={(event) => grid.handleSearch(event.target.value)}
          />
        }>
        <ServerPaginatedDataGrid<IBoardSummary>
          dataTestId="boards-table"
          rows={boardsQuery.data?.boards ?? []}
          columns={columns}
          getRowId={(row) => row.board_id}
          noRowsMessage="No boards"
          rowCount={rowCount}
          paginationModel={grid.paginationModel}
          setPaginationModel={grid.handlePaginationChange}
          sortModel={grid.sortModel}
          setSortModel={grid.handleSortChange}
          onRowClick={(row) => navigate(`/admin/tickets/boards/${row.board_id}`)}
        />
      </PageSection>

      <BoardDialog
        open={isDialogOpen}
        board={editingBoard}
        isLoading={saveBoardMutation.isPending}
        dialogError={saveBoardMutation.error?.message}
        onCancel={closeDialog}
        onSave={handleSaveBoard}
      />
    </>
  );
};
