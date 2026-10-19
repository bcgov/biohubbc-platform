import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Grid from '@mui/material/Grid';
import Link from '@mui/material/Link';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QueryErrorDialog } from 'components/dialog/QueryErrorDialog';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { PageSection } from 'components/section/PageSection';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { IBoardSummary } from 'interfaces/useBoardsApi.interface';
import { AdminPageLayout } from 'layouts/AdminPageLayout';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { refreshChangedQueries } from 'utils/query-client';
import { boardQueryKeys } from 'utils/query-keys/board-query-keys';
import { changedQueryKeys } from 'utils/query-keys/changed-query-keys';
import { AdminBoardCard } from './content/AdminBoardCard';
import { BoardDialog } from './dialog/BoardDialog';
import { IBoardFormValues } from './form/BoardForm';
import { useSaveBoardMutation } from './hooks/useSaveBoardMutation';

/**
 * Administrative boards page: every ticket board as a card, with create, edit and delete. A card opens its board.
 *
 * @returns {JSX.Element} The boards page.
 */
export const AdminBoardsPage = () => {
  const api = useApi();
  const queryClient = useQueryClient();
  const dialogContext = useDialogContext();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBoard, setEditingBoard] = useState<IBoardSummary | undefined>();

  const boardsQuery = useQuery({
    queryKey: boardQueryKeys.list(),
    queryFn: ({ signal }) => api.boards.getBoards({ signal })
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

  /**
   * Asks for confirmation before deleting a board and its swimlanes. Tickets and tags are not affected.
   *
   * @param {IBoardSummary} board The board to delete.
   * @returns {void}
   */
  const handleDeleteBoard = (board: IBoardSummary) => {
    const closeConfirmation = () => dialogContext.setYesNoDialog({ open: false });

    dialogContext.setYesNoDialog({
      open: true,
      dialogTitle: 'Delete board?',
      dialogContent: (
        <Typography component="div" color="textSecondary">
          Deleting board <strong>{board.name}</strong> also deletes its swimlanes. Tickets and tags are not affected.
          Are you sure you want to proceed?
        </Typography>
      ),
      yesButtonLabel: 'Delete Board',
      noButtonLabel: 'Cancel',
      yesButtonProps: { color: 'error' },
      onClose: closeConfirmation,
      onNo: closeConfirmation,
      onYes: () => {
        closeConfirmation();
        deleteBoardMutation.mutate(board);
      }
    });
  };

  const boards = boardsQuery.data?.boards ?? [];

  return (
    <>
      <AdminPageLayout
        title="Boards"
        breadcrumbs={
          <Breadcrumbs aria-label="boards breadcrumb">
            <Link component={RouterLink} to="/admin" underline="hover" color="inherit">
              Administration
            </Link>
            <Typography variant="inherit" color="text.primary" aria-current="page">
              Boards
            </Typography>
          </Breadcrumbs>
        }
        tabs={[{ value: 'boards', label: 'Boards', id: 'boards-tab', ariaControls: 'boards-panel' }]}
        activeTab="boards"
        onTabChange={() => {}}>
        <Box id="boards-panel" role="tabpanel" aria-labelledby="boards-tab">
          <QueryErrorDialog error={boardsQuery.error} label="boards" />
          <PageSection
            id="boards"
            label={
              <>
                Boards{' '}
                <Typography sx={{ fontSize: 'inherit' }} component="span" color="textSecondary">
                  ({boards.length})
                </Typography>
              </>
            }
            onAdd={() => setIsDialogOpen(true)}
            addLabel="New Board">
            <Box sx={{ p: 2 }}>
              <LoadingGuard
                isLoading={boardsQuery.isPending}
                isLoadingFallback={
                  <Grid container spacing={2}>
                    {[0, 1, 2].map((index) => (
                      <Grid key={index} size={{ xs: 12, sm: 6, md: 4 }}>
                        <Skeleton variant="rounded" height={160} />
                      </Grid>
                    ))}
                  </Grid>
                }
                hasNoData={!boards.length}
                hasNoDataFallback={
                  <Typography variant="body2" color="text.secondary">
                    No boards
                  </Typography>
                }>
                <Grid container spacing={2}>
                  {boards.map((board) => (
                    <Grid key={board.board_id} size={{ xs: 12, sm: 6, md: 4 }}>
                      <AdminBoardCard
                        board={board}
                        onEditBoard={(selected) => {
                          setEditingBoard(selected);
                          setIsDialogOpen(true);
                        }}
                        onDeleteBoard={handleDeleteBoard}
                      />
                    </Grid>
                  ))}
                </Grid>
              </LoadingGuard>
            </Box>
          </PageSection>
        </Box>
      </AdminPageLayout>

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
