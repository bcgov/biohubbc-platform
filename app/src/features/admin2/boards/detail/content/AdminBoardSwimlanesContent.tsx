import Typography from '@mui/material/Typography';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QueryErrorDialog } from 'components/dialog/QueryErrorDialog';
import { PageSection } from 'components/section/PageSection';
import { getTagColor } from 'features/admin2/tags/form/tag-color';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { useServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import { IBoardSwimlane, IBoardSwimlaneRequest } from 'interfaces/useBoardsApi.interface';
import { useCallback, useState } from 'react';
import { refreshChangedQueries } from 'utils/query-client';
import { boardQueryKeys } from 'utils/query-keys/board-query-keys';
import { changedQueryKeys } from 'utils/query-keys/changed-query-keys';
import { BoardSwimlaneDialog } from '../../dialog/BoardSwimlaneDialog';
import { IBoardSwimlaneFormValues } from '../../form/BoardSwimlaneForm';
import { AdminBoardSwimlanesTable } from '../../table/AdminBoardSwimlanesTable';

interface IAdminBoardSwimlanesContentProps {
  /** The board whose swimlanes are listed. */
  boardId: string;
}

/**
 * Swimlanes tab of a board's page: the server-paginated list of the board's lanes in display order, with create, edit
 * and delete. Every ticket on the board is in exactly one lane, so a lane with tickets cannot be deleted until they
 * are moved or taken off the board; the server's refusal is reported.
 *
 * A save keeps its dialog open and shows the server's error, such as a duplicate name, in the dialog.
 *
 * @param {IAdminBoardSwimlanesContentProps} props The board whose swimlanes are listed.
 * @returns {JSX.Element} The board's swimlanes table and its dialogs.
 */
export const AdminBoardSwimlanesContent = (props: IAdminBoardSwimlanesContentProps) => {
  const { boardId } = props;
  const api = useApi();
  const queryClient = useQueryClient();
  const dialogContext = useDialogContext();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSwimlane, setEditingSwimlane] = useState<IBoardSwimlane | undefined>();

  const grid = useServerPaginatedGridState({ defaultSort: { field: 'sort_order', sort: 'asc' } });
  const swimlanesQuery = useQuery({
    queryKey: boardQueryKeys.swimlanes(boardId, grid.apiPagination),
    queryFn: ({ signal }) => api.boards.getBoardSwimlanes(boardId, grid.apiPagination, { signal }),
    placeholderData: keepPreviousData
  });

  const saveSwimlaneMutation = useMutation({
    mutationFn: ({
      boardSwimlaneId,
      values
    }: {
      boardSwimlaneId: string | undefined;
      values: IBoardSwimlaneFormValues;
    }) => {
      const payload: IBoardSwimlaneRequest = {
        name: values.name.trim(),
        description: values.description?.trim() || null,
        color: values.color ? getTagColor(values.color) : null,
        sortOrder: values.sortOrder ? Number(values.sortOrder) : undefined
      };

      if (boardSwimlaneId) {
        return api.boards.updateBoardSwimlane(boardId, boardSwimlaneId, payload);
      }

      return api.boards.createBoardSwimlane(boardId, payload);
    },
    onSuccess: (savedSwimlane, { boardSwimlaneId }) => {
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: boardSwimlaneId
          ? `Updated swimlane ${savedSwimlane.name}`
          : `Created swimlane ${savedSwimlane.name}`
      });
      closeDialog();
      void refreshChangedQueries(queryClient, changedQueryKeys.boardSwimlane(boardId));
    }
  });

  const deleteSwimlaneMutation = useMutation({
    mutationFn: (swimlane: IBoardSwimlane) => api.boards.deleteBoardSwimlane(boardId, swimlane.board_swimlane_id),
    onSuccess: (_data, swimlane) => {
      dialogContext.setSnackbar({ open: true, snackbarMessage: `Deleted swimlane ${swimlane.name}` });
      void refreshChangedQueries(queryClient, changedQueryKeys.boardSwimlane(boardId));
    },
    onError: (error: Error) => dialogContext.setSnackbar({ open: true, snackbarMessage: error.message })
  });
  const { mutate: deleteSwimlane } = deleteSwimlaneMutation;

  /**
   * Closes the swimlane dialog and clears the swimlane it was editing and its last error.
   *
   * @returns {void}
   */
  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingSwimlane(undefined);
    saveSwimlaneMutation.reset();
  };

  const handleEditSwimlane = useCallback((swimlane: IBoardSwimlane) => {
    setEditingSwimlane(swimlane);
    setIsDialogOpen(true);
  }, []);

  /**
   * Asks for confirmation before deleting a swimlane, which must have no tickets.
   *
   * @param {IBoardSwimlane} swimlane The swimlane to delete.
   * @returns {void}
   */
  const handleDeleteSwimlane = useCallback(
    (swimlane: IBoardSwimlane) => {
      const closeConfirmation = () => dialogContext.setYesNoDialog({ open: false });

      dialogContext.setYesNoDialog({
        open: true,
        dialogTitle: 'Delete swimlane?',
        dialogContent: (
          <Typography component="div" color="textSecondary">
            Delete swimlane <strong>{swimlane.name}</strong>? A swimlane with tickets cannot be deleted until they are
            moved to another swimlane or taken off the board.
          </Typography>
        ),
        yesButtonLabel: 'Delete Swimlane',
        noButtonLabel: 'Cancel',
        yesButtonProps: { color: 'error' },
        onClose: closeConfirmation,
        onNo: closeConfirmation,
        onYes: () => {
          closeConfirmation();
          deleteSwimlane(swimlane);
        }
      });
    },
    [deleteSwimlane, dialogContext]
  );

  const rowCount = swimlanesQuery.data?.pagination.total ?? 0;

  return (
    <>
      <QueryErrorDialog error={swimlanesQuery.error} label="board swimlanes" />
      <PageSection
        id="board-swimlanes"
        label={
          <>
            Swimlanes{' '}
            <Typography sx={{ fontSize: 'inherit' }} component="span" color="textSecondary">
              ({rowCount})
            </Typography>
          </>
        }
        onAdd={() => setIsDialogOpen(true)}
        addLabel="New Swimlane">
        <AdminBoardSwimlanesTable
          swimlanes={swimlanesQuery.data?.swimlanes ?? []}
          rowCount={rowCount}
          paginationModel={grid.paginationModel}
          setPaginationModel={grid.handlePaginationChange}
          sortModel={grid.sortModel}
          setSortModel={grid.handleSortChange}
          onEditSwimlane={handleEditSwimlane}
          onDeleteSwimlane={handleDeleteSwimlane}
        />
      </PageSection>

      <BoardSwimlaneDialog
        open={isDialogOpen}
        swimlane={editingSwimlane}
        isLoading={saveSwimlaneMutation.isPending}
        dialogError={saveSwimlaneMutation.error?.message}
        onCancel={closeDialog}
        onSave={(values) =>
          saveSwimlaneMutation.mutate({ boardSwimlaneId: editingSwimlane?.board_swimlane_id, values })
        }
      />
    </>
  );
};
